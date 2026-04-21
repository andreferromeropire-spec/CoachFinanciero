import imapSimple from "imap-simple";
import { simpleParser } from "mailparser";
import { prisma } from "@coach/db";
import { parseEmail } from "./emailParser";
import { mapCategory } from "./CategoryMapper";

// Known senders we care about
const KNOWN_SENDERS = [
  "noreply@pedidosya.com",
  "no-reply@rappi.com",
  "no-reply@rappi.com.ar",
  "noreply@rappi.com.ar",
  "notificaciones@rappi.com.ar",
  "noreply@mercadolibre.com",
  "uber.receipts@uber.com",
  "receipts@uber.com",
  "noreply@uber.com",
  "notificaciones@galicia.com.ar",
  "alertas@brubank.com",
  "no-reply@bbva.com.ar",
  "noreply@bbva.com.ar",
  "payments@paypal.com",
  "service@paypal.com",
  "transfers@wise.com",
  "no-reply@mercadopago.com",
  "noreply@mercadopago.com",
];

export interface ImportProgress {
  processed: number;
  total: number;
  percent: number;
  currentSubject?: string;
}

export interface ImportResult {
  done: true;
  imported: number;
  duplicates: number;
  errors: number;
  total: number;
}

export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
}

function getImapConfig(): ImapConfig {
  return {
    host: process.env.IMAP_HOST ?? "imap.gmail.com",
    port: parseInt(process.env.IMAP_PORT ?? "993"),
    user: process.env.IMAP_USER ?? "",
    password: process.env.IMAP_PASSWORD ?? "",
    tls: true,
  };
}

export async function importImapHistory(options: {
  userId: string;
  since?: Date;
  mailboxes?: string[];
  onProgress?: (p: ImportProgress) => void;
}): Promise<ImportResult> {
  const { userId, onProgress } = options;
  const since = options.since ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const mailboxes = options.mailboxes ?? ["INBOX"];

  const cfg = getImapConfig();
  if (!cfg.user || !cfg.password) {
    throw new Error("IMAP credentials not configured. Set IMAP_USER and IMAP_PASSWORD in .env");
  }

  const connection = await imapSimple.connect({
    imap: {
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      tls: cfg.tls,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000,
    },
  });

  let imported = 0;
  let duplicates = 0;
  let errors = 0;
  let total = 0;

  try {
    for (const mailbox of mailboxes) {
      await connection.openBox(mailbox);

      // Build search criteria: FROM any known sender + SINCE date
      const sinceStr = since.toLocaleDateString("en-US", {
        month: "short", day: "2-digit", year: "numeric",
      });

      // Search for messages from any known sender
      const searchCriteria = [
        ["SINCE", sinceStr],
        ["OR",
          ...KNOWN_SENDERS.map((s) => ["FROM", s]),
        ],
      ];

      const fetchOptions = {
        bodies: ["HEADER.FIELDS (FROM SUBJECT DATE MESSAGE-ID)", "TEXT", ""],
        struct: true,
      };

      let messages: imapSimple.Message[];
      try {
        messages = await connection.search(searchCriteria, fetchOptions);
      } catch {
        // Some IMAP servers don't support nested OR — fall back to SINCE only
        const fallbackCriteria = [["SINCE", sinceStr]];
        messages = await connection.search(fallbackCriteria, fetchOptions);
      }

      total += messages.length;
      console.log(`[imap] Found ${messages.length} messages in ${mailbox}`);

      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];

        try {
          // Get raw body for mailparser
          const allParts = imapSimple.getParts(msg.attributes.struct as imapSimple.MessageBodyPart[]);
          const bodyPart = msg.parts.find((p) => p.which === "") ?? msg.parts[0];
          const rawBody = bodyPart?.body ?? "";

          // Parse with mailparser for full headers
          const parsed = await simpleParser(rawBody);

          const messageId = parsed.messageId ?? `${msg.attributes.uid}-${mailbox}`;
          const from = parsed.from?.text ?? "";
          const subject = parsed.subject ?? "";
          const date = parsed.date ?? new Date();

          // Skip if not from a known sender
          const fromLower = from.toLowerCase();
          const isKnown = KNOWN_SENDERS.some((s) => fromLower.includes(s.toLowerCase()));
          if (!isKnown) {
            // Still counts toward progress but skip
            onProgress?.({
              processed: i + 1,
              total,
              percent: ((i + 1) / total) * 100,
            });
            continue;
          }

          // Check if already ingested
          const existing = await prisma.emailIngest.findFirst({
            where: { messageId },
          });
          if (existing) {
            duplicates++;
            onProgress?.({ processed: i + 1, total, percent: ((i + 1) / total) * 100 });
            continue;
          }

          const htmlBody = parsed.html || undefined;
          const textBody = parsed.text || undefined;

          // Parse the email with our parsers
          const emailParsed = parseEmail({ from, subject, htmlBody, textBody });

          // Save ingest record regardless
          const ingest = await prisma.emailIngest.create({
            data: {
              userId,
              from,
              subject,
              messageId,
              rawBody: textBody || htmlBody || rawBody.slice(0, 50000),
              receivedAt: date,
              status: emailParsed ? "PENDING" : "FAILED",
            },
          });

          if (!emailParsed) {
            errors++;
            onProgress?.({ processed: i + 1, total, percent: ((i + 1) / total) * 100, currentSubject: subject });
            continue;
          }

          // Find or create account
          let account = await prisma.account.findFirst({
            where: { userId, provider: "MANUAL" },
          });
          if (!account) {
            account = await prisma.account.create({
              data: { userId, name: "Email Import", type: "CHECKING", currency: "ARS", provider: "MANUAL" },
            });
          }

          const category = emailParsed.category ?? mapCategory(emailParsed.merchant, emailParsed.description);

          const transaction = await prisma.transaction.create({
            data: {
              userId,
              accountId: account.id,
              amount: emailParsed.amount,
              currency: emailParsed.currency,
              description: emailParsed.description,
              merchant: emailParsed.merchant,
              merchantNormalized: emailParsed.merchantNormalized,
              date: emailParsed.date,
              source: "EMAIL",
              category,
              rawData: JSON.parse(JSON.stringify({
                from, subject, htmlBody, textBody,
                ...(emailParsed.items ? { items: emailParsed.items } : {}),
              })),
            },
          });

          await prisma.emailIngest.update({
            where: { id: ingest.id },
            data: { status: "PARSED", parsedAt: new Date(), transactionId: transaction.id },
          });

          imported++;
          console.log(`[imap] [${i + 1}/${total}] Imported: ${subject}`);
        } catch (err) {
          errors++;
          console.error(`[imap] Error processing message ${i + 1}:`, err);
        }

        onProgress?.({
          processed: i + 1,
          total,
          percent: ((i + 1) / total) * 100,
          currentSubject: msg.parts[0]?.body?.toString().slice(0, 80),
        });
      }
    }
  } finally {
    connection.end();
  }

  return { done: true, imported, duplicates, errors, total };
}
