import { prisma } from "@coach/db";
import { parseEmail } from "./emailParser";

interface ImportOptions {
  accountId:    string;
  userId:       string;
  accessToken:  string;
  refreshToken?: string;
  email:        string;
  since?:       Date;
  maxEmails:    number;
  onProgress:   (msg: string) => void;
}

interface ImportResult {
  processed: number;
  imported:  number;
  duplicates: number;
  errors:    number;
}

// Refresca el access token si expiró
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     process.env.GOOGLE_CLIENT_ID     ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type:    "refresh_token",
    }),
  });
  const data = await res.json() as { access_token?: string };
  return data.access_token ?? null;
}

// Decodifica base64url a string
function b64decode(str: string): string {
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

// Extrae texto plano y HTML de las partes del mensaje Gmail
function extractParts(payload: GmailPayload): { text: string; html: string } {
  let text = "";
  let html = "";

  function traverse(part: GmailPayload) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      text += b64decode(part.body.data);
    } else if (part.mimeType === "text/html" && part.body?.data) {
      html += b64decode(part.body.data);
    }
    if (part.parts) part.parts.forEach(traverse);
  }

  traverse(payload);
  return { text, html };
}

interface GmailPayload {
  mimeType?: string;
  body?:     { data?: string };
  parts?:    GmailPayload[];
  headers?:  Array<{ name: string; value: string }>;
}

interface GmailMessage {
  id: string;
  threadId: string;
  payload?: GmailPayload;
  internalDate?: string;
}

async function gmailFetch(path: string, token: string, attempt = 0): Promise<unknown> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new Error("TOKEN_EXPIRED");
  if (res.status === 429 && attempt < 6) {
    const wait = Math.min(8000, 500 * 2 ** attempt);
    await new Promise((r) => setTimeout(r, wait));
    return gmailFetch(path, token, attempt + 1);
  }
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Gmail API ${res.status}: ${errBody.slice(0, 200)}`);
  }
  return res.json();
}

export async function importGmailHistory(opts: ImportOptions): Promise<ImportResult> {
  const { accountId, userId, email, maxEmails, onProgress } = opts;
  let { accessToken } = opts;

  const result: ImportResult = { processed: 0, imported: 0, duplicates: 0, errors: 0 };

  // Construir query para Gmail — bancos, pagos y delivery (debe coincidir con quienes parseamos en emailParser)
  const sinceTs = opts.since
    ? Math.floor(opts.since.getTime() / 1000)
    : Math.floor((Date.now() - 90 * 24 * 3600 * 1000) / 1000); // últimos 90 días

  const senders =
    "from:mercadopago OR from:mercadolibre OR from:paypal OR from:wise OR from:bbva OR from:galicia OR from:naranja OR from:brubank OR from:ualá OR from:lemon OR from:prex OR from:macro OR from:santander OR from:hsbc OR from:icbc OR from:supervielle OR from:bancor OR from:bind OR from:openbank OR " +
    "from:rappi OR from:pedidosya OR from:ubereats OR from:uber.com OR from:glovo OR from:cornershop OR from:justo";
  const query = `after:${sinceTs} (${senders})`;

  onProgress(`Buscando emails en ${email}…`);

  const cap = Math.min(Math.max(maxEmails, 1), 5000);

  async function listMessageIds(token: string): Promise<string[]> {
    const ids: string[] = [];
    let pageToken: string | undefined;
    while (ids.length < cap) {
      const pageSize = Math.min(500, cap - ids.length);
      let path = `users/me/messages?maxResults=${pageSize}&q=${encodeURIComponent(query)}`;
      if (pageToken) path += `&pageToken=${encodeURIComponent(pageToken)}`;
      const listData = await gmailFetch(path, token) as {
        messages?: Array<{ id: string }>;
        nextPageToken?: string;
      };
      const batch = (listData.messages ?? []).map(m => m.id);
      if (batch.length === 0) break;
      ids.push(...batch);
      pageToken = listData.nextPageToken;
      if (!pageToken) break;
      if (ids.length < cap) {
        onProgress(`Listando bandeja… ${ids.length} mensajes encontrados`);
      }
    }
    return ids;
  }

  let messageIds: string[] = [];
  try {
    messageIds = await listMessageIds(accessToken);
  } catch (err) {
    if (String(err).includes("TOKEN_EXPIRED") && opts.refreshToken) {
      onProgress("Renovando token…");
      const newToken = await refreshAccessToken(opts.refreshToken);
      if (!newToken) throw new Error("No se pudo renovar el token. Reconectá la cuenta.");
      accessToken = newToken;
      await prisma.connectedEmail.update({
        where: { id: accountId },
        data:  { accessToken },
      });
      messageIds = await listMessageIds(accessToken);
    } else {
      throw err;
    }
  }

  onProgress(`Encontré ${messageIds.length} emails. Procesando…`);

  // Buscar la primera cuenta del usuario para asociar transacciones
  const defaultAccount = await prisma.account.findFirst({ where: { userId } });

  function headerFrom(msg: GmailMessage, name: string): string {
    const headers = msg.payload?.headers ?? [];
    return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
  }

  const total = messageIds.length;
  for (const msgId of messageIds) {
    result.processed++;
    try {
      // 1) Solo metadatos — liviano; evita bajar el cuerpo completo si ya está importado
      const metaPath =
        `users/me/messages/${encodeURIComponent(msgId)}?format=metadata` +
        "&metadataHeaders=Message-ID&metadataHeaders=From&metadataHeaders=Subject";
      const meta = await gmailFetch(metaPath, accessToken) as GmailMessage;

      const fromMeta = headerFrom(meta, "From");
      const subjectMeta = headerFrom(meta, "Subject");
      const messageIdKey = headerFrom(meta, "Message-ID") || msgId;

      const existing = await prisma.emailIngest.findUnique({ where: { messageId: messageIdKey } });
      if (existing) {
        // Ya hay fila de ingest: si ya tiene movimiento, es duplicado real.
        if (existing.transactionId) {
          result.duplicates++;
          if (result.processed % 25 === 0 || result.processed === total) {
            onProgress(`${result.processed}/${total} — ${result.imported} nuevas, ${result.duplicates} ya importados…`);
          }
          continue;
        }

        // Huérfano: se guardó el mail (p. ej. PARSED) pero no había cuenta para crear Transaction.
        if (existing.userId !== userId || !defaultAccount) {
          result.duplicates++;
          if (result.processed % 25 === 0 || result.processed === total) {
            onProgress(`${result.processed}/${total} — ${result.imported} nuevas, ${result.duplicates} pendientes sin cuenta…`);
          }
          continue;
        }

        const rb = existing.rawBody ?? "";
        const looksHtml = /<\w+[\s>]/.test(rb);
        const parsedOrphan = parseEmail({
          from:      existing.from,
          subject: existing.subject,
          htmlBody:  looksHtml ? rb : undefined,
          textBody:  looksHtml ? undefined : rb,
        });

        if (parsedOrphan) {
          const tx = await prisma.transaction.create({
            data: {
              userId,
              accountId:   defaultAccount.id,
              amount:      parsedOrphan.amount,
              currency:    parsedOrphan.currency,
              description: parsedOrphan.description,
              category:    parsedOrphan.category ?? undefined,
              merchant:    parsedOrphan.merchantNormalized ?? parsedOrphan.merchant ?? undefined,
              date:        parsedOrphan.date,
              source:      "EMAIL",
              rawData:     JSON.parse(JSON.stringify({
                from: existing.from, subject: existing.subject, items: parsedOrphan.items,
              })),
            },
          });
          await prisma.emailIngest.update({
            where: { id: existing.id },
            data:  {
              transactionId: tx.id,
              parsedAt:        new Date(),
              status:          "PARSED",
            },
          });
          result.imported++;
        } else {
          await prisma.emailIngest.update({
            where: { id: existing.id },
            data:  { status: "FAILED", parsedAt: null },
          });
          result.errors++;
        }

        if (result.processed % 5 === 0 || result.processed === total) {
          onProgress(
            `${result.processed}/${total} — ${result.imported} movimientos (incl. pendientes viejos), ${result.duplicates} ya OK…`,
          );
        }
        continue;
      }

      // 2) Mail nuevo: bajar cuerpo completo para parsear
      const msg = await gmailFetch(
        `users/me/messages/${encodeURIComponent(msgId)}?format=full`,
        accessToken,
      ) as GmailMessage;

      const from      = headerFrom(msg, "From") || fromMeta;
      const subject   = headerFrom(msg, "Subject") || subjectMeta;
      const messageId = headerFrom(msg, "Message-ID") || messageIdKey;
      const receivedAt = msg.internalDate ? new Date(parseInt(msg.internalDate, 10)) : new Date();

      const { text, html } = extractParts(msg.payload ?? {});

      // Parsear email para extraer transacción
      const parsed = parseEmail({ from, subject, htmlBody: html, textBody: text });

      const ingest = await prisma.emailIngest.create({
        data: {
          userId,
          from,
          subject,
          messageId,
          receivedAt,
          rawBody: html || text,
          status:  parsed ? "PARSED" : "FAILED",
          parsedAt: parsed ? new Date() : undefined,
        },
      });

      if (parsed && defaultAccount) {
        const tx = await prisma.transaction.create({
          data: {
            userId,
            accountId:   defaultAccount.id,
            amount:      parsed.amount,
            currency:    parsed.currency,
            description: parsed.description,
            category:    parsed.category ?? undefined,
            merchant:    parsed.merchantNormalized ?? parsed.merchant ?? undefined,
            date:        parsed.date,
            source:      "EMAIL",
            rawData:     JSON.parse(JSON.stringify({ from, subject, items: parsed.items })),
          },
        });
        await prisma.emailIngest.update({
          where: { id: ingest.id },
          data:  { transactionId: tx.id },
        });
        result.imported++;
      } else if (!parsed) {
        result.errors++;
      }

      if (result.processed % 5 === 0 || result.processed === total) {
        onProgress(
          `${result.processed}/${total} — ${result.imported} importadas, ${result.duplicates} duplicados, ${result.errors} sin parsear…`,
        );
      }
    } catch (err) {
      result.errors++;
      console.error(`[GmailImport] error en msg ${msgId}:`, err);
      if (result.processed % 20 === 0) {
        onProgress(`${result.processed}/${total} — error en algunos mensajes, sigue…`);
      }
    }
  }

  onProgress(`Listo: ${result.imported} transacciones importadas, ${result.duplicates} duplicados, ${result.errors} sin parsear.`);
  return result;
}
