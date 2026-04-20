import { Router, Request, Response } from "express";
import multer from "multer";
import { prisma } from "@coach/db";
import { parseEmail } from "../services/emailParser";
import { parseCsv, type CsvProvider } from "../services/CsvParser";
import { mapCategory } from "../services/CategoryMapper";
import { importImapHistory } from "../services/ImapHistoryService";
import type { AuthRequest } from "../middleware/auth";

export const ingestRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

interface IngestEmailBody {
  from: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
  receivedAt?: string;
}

ingestRouter.post("/email", async (req: Request, res: Response) => {
  const { from, subject, htmlBody, textBody, receivedAt } = req.body as IngestEmailBody;

  if (!from || !subject) {
    res.status(400).json({ error: "from and subject are required" });
    return;
  }

  const ingest = await prisma.emailIngest.create({
    data: {
      from,
      subject,
      rawBody: textBody || htmlBody || "",
      receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
      status: "PENDING",
    },
  });

  const parsed = parseEmail({ from, subject, htmlBody, textBody });

  if (!parsed) {
    await prisma.emailIngest.update({
      where: { id: ingest.id },
      data: { status: "FAILED", parsedAt: new Date() },
    });
    console.warn(`[ingest] No parser matched for: ${subject}`);
    res.status(422).json({ error: "No parser matched this email", ingestId: ingest.id });
    return;
  }

  // Deduplication: same accountHint + amount + date ±1 hour
  const oneHour = 60 * 60 * 1000;
  const existing = await prisma.transaction.findFirst({
    where: {
      amount: parsed.amount,
      date: {
        gte: new Date(parsed.date.getTime() - oneHour),
        lte: new Date(parsed.date.getTime() + oneHour),
      },
      ...(parsed.accountHint
        ? {
            account: {
              name: { contains: parsed.accountHint },
            },
          }
        : {}),
    },
  });

  if (existing) {
    await prisma.emailIngest.update({
      where: { id: ingest.id },
      data: { status: "DUPLICATE", parsedAt: new Date(), transactionId: existing.id },
    });
    res.json({ status: "duplicate", ingestId: ingest.id, transactionId: existing.id });
    return;
  }

  // Find or use a fallback MANUAL account
  let account = await prisma.account.findFirst({
    where: parsed.accountHint
      ? { name: { contains: parsed.accountHint } }
      : { provider: "MANUAL" },
  });

  if (!account) {
    account = await prisma.account.create({
      data: {
        name: parsed.accountHint || "Email Import",
        type: "CHECKING",
        currency: parsed.currency,
        provider: "MANUAL",
      },
    });
  }

  // Prefer category from parser (item-based), fallback to keyword mapper
  const category = parsed.category ?? mapCategory(parsed.merchant, parsed.description);

  const transaction = await prisma.transaction.create({
    data: {
      accountId: account.id,
      amount: parsed.amount,
      currency: parsed.currency,
      description: parsed.description,
      merchant: parsed.merchant,
      merchantNormalized: parsed.merchantNormalized,
      date: parsed.date,
      source: "EMAIL",
      category,
      rawData: JSON.parse(JSON.stringify({
        from,
        subject,
        htmlBody,
        textBody,
        ...(parsed.items ? { items: parsed.items } : {}),
      })),
    },
  });

  await prisma.emailIngest.update({
    where: { id: ingest.id },
    data: { status: "PARSED", parsedAt: new Date(), transactionId: transaction.id },
  });

  res.json({ status: "ok", ingestId: ingest.id, transactionId: transaction.id });
});

// ── POST /api/ingest/csv ──────────────────────────────────────────────────────

ingestRouter.post("/csv", upload.single("file"), async (req: Request, res: Response) => {
  const provider = (req.body?.provider as string | undefined)?.toUpperCase() as CsvProvider | undefined;
  const allowedProviders: CsvProvider[] = ["BBVA", "GALICIA", "BRUBANK"];

  if (!provider || !allowedProviders.includes(provider)) {
    res.status(400).json({ error: `provider must be one of: ${allowedProviders.join(", ")}` });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const content = req.file.buffer.toString("utf-8");
  let rows;
  try {
    rows = parseCsv(content, provider);
  } catch (err) {
    res.status(422).json({ error: "Failed to parse CSV", detail: String(err) });
    return;
  }

  let account = await prisma.account.findFirst({ where: { provider } });
  if (!account) {
    account = await prisma.account.create({
      data: { name: `${provider} Import`, type: "CHECKING", currency: "ARS", provider },
    });
  }

  let imported = 0;
  let duplicates = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const existing = await prisma.transaction.findFirst({
        where: {
          accountId: account.id,
          amount: row.amount,
          description: row.description,
          date: {
            gte: new Date(row.date.getTime() - 3600000),
            lte: new Date(row.date.getTime() + 3600000),
          },
        },
      });

      if (existing) {
        duplicates++;
        continue;
      }

      const category = mapCategory(row.merchantNormalized, row.description);

      await prisma.transaction.create({
        data: {
          accountId: account.id,
          amount: row.amount,
          currency: row.currency,
          description: row.description,
          merchantNormalized: row.merchantNormalized,
          date: row.date,
          source: "CSV",
          category,
        },
      });

      imported++;
    } catch (err) {
      errors.push(`Row ${row.date.toISOString()} / ${row.description}: ${String(err)}`);
    }
  }

  res.json({ imported, duplicates, errors });
});

// ── POST /api/ingest/imap/history — importar historial IMAP con SSE ───────────

ingestRouter.post("/imap/history", async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId ?? "default-user";
  const { since, mailboxes } = req.body as { since?: string; mailboxes?: string[] };

  // Set up Server-Sent Events
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    const result = await importImapHistory({
      userId,
      since: sinceDate,
      mailboxes: mailboxes ?? ["INBOX"],
      onProgress: (p) => send(p),
    });

    send(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[imap] Import failed:", msg);
    send({ error: msg });
  }

  res.end();
});
