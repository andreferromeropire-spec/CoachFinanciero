import { Router, Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "@coach/db";
import { mapCategory } from "../services/CategoryMapper";

export const webhooksRouter = Router();

// ── Mercado Pago ─────────────────────────────────────────────────────────────

webhooksRouter.post("/mercadopago", async (req: Request, res: Response) => {
  // Respond 200 immediately, process async
  res.sendStatus(200);

  const signature = req.headers["x-signature"] as string | undefined;
  const requestId = req.headers["x-request-id"] as string | undefined;

  if (!verifyMercadoPagoSignature(signature, requestId, req.body)) {
    console.warn("[webhook/mp] Invalid signature — ignoring");
    return;
  }

  const { type, data } = req.body as { type: string; data?: { id?: string } };

  if (type !== "payment" || !data?.id) return;

  try {
    await processMercadoPagoPayment(String(data.id));
  } catch (err) {
    console.error("[webhook/mp] Processing error:", err);
  }
});

function verifyMercadoPagoSignature(
  xSignature: string | undefined,
  xRequestId: string | undefined,
  body: unknown
): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true; // skip verification in dev without secret

  if (!xSignature) return false;

  const parts = xSignature.split(",").reduce<Record<string, string>>((acc, part) => {
    const [k, v] = part.trim().split("=");
    if (k && v) acc[k] = v;
    return acc;
  }, {});

  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  const dataId = (body as { data?: { id?: string } })?.data?.id ?? "";
  const manifest = `id:${dataId};request-id:${xRequestId ?? ""};ts:${ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
}

async function processMercadoPagoPayment(paymentId: string) {
  const mpToken = process.env.MP_ACCESS_TOKEN;
  if (!mpToken) {
    console.warn("[webhook/mp] MP_ACCESS_TOKEN not set — skipping API call");
    return;
  }

  const resp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${mpToken}` },
  });

  if (!resp.ok) {
    console.error(`[webhook/mp] Failed to fetch payment ${paymentId}: ${resp.status}`);
    return;
  }

  const payment = (await resp.json()) as {
    status: string;
    transaction_amount: number;
    currency_id: string;
    description?: string;
    date_approved?: string;
    payment_method_id?: string;
    collector?: { id?: string };
    payer?: { email?: string };
  };

  if (!["approved", "authorized"].includes(payment.status)) return;

  const account = await prisma.account.findFirst({ where: { provider: "MERCADOPAGO" } });
  if (!account) {
    console.warn("[webhook/mp] No MercadoPago account configured");
    return;
  }

  const isCredit = String(payment.collector?.id) === process.env.MP_COLLECTOR_ID;
  const amount = isCredit ? payment.transaction_amount : -payment.transaction_amount;
  const date = payment.date_approved ? new Date(payment.date_approved) : new Date();
  const merchant = payment.payer?.email ?? null;

  // Dedup
  const existing = await prisma.transaction.findFirst({
    where: {
      amount,
      date: { gte: new Date(date.getTime() - 3600000), lte: new Date(date.getTime() + 3600000) },
      accountId: account.id,
    },
  });
  if (existing) return;

  const category = mapCategory(merchant, payment.description ?? null);

  await prisma.transaction.create({
    data: {
      accountId: account.id,
      amount,
      currency: payment.currency_id ?? "ARS",
      description: payment.description ?? `Pago MP #${paymentId}`,
      merchant,
      date,
      source: "API",
      category,
      rawData: payment as object,
    },
  });

  console.log(`[webhook/mp] Payment ${paymentId} imported`);
}

// ── PayPal ────────────────────────────────────────────────────────────────────

webhooksRouter.post("/paypal", async (req: Request, res: Response) => {
  const verified = await verifyPayPalWebhook(req);
  if (!verified) {
    console.warn("[webhook/paypal] Verification failed");
    res.sendStatus(401);
    return;
  }

  res.sendStatus(200);

  const { event_type, resource } = req.body as {
    event_type: string;
    resource?: {
      amount?: { total?: string; currency?: string };
      transaction_fee?: { value?: string };
      parent_payment?: string;
      invoice_number?: string;
      create_time?: string;
      update_time?: string;
      payee?: { email_address?: string };
    };
  };

  if (!["PAYMENT.SALE.COMPLETED", "PAYMENT.SALE.REVERSED"].includes(event_type)) return;

  try {
    const account = await prisma.account.findFirst({ where: { provider: "PAYPAL" } });
    if (!account) return;

    const total = parseFloat(resource?.amount?.total ?? "0");
    const currency = resource?.amount?.currency ?? "USD";
    const isReversed = event_type === "PAYMENT.SALE.REVERSED";
    const amount = isReversed ? total : -total;
    const date = resource?.update_time
      ? new Date(resource.update_time)
      : resource?.create_time
      ? new Date(resource.create_time)
      : new Date();

    const existing = await prisma.transaction.findFirst({
      where: {
        amount,
        date: { gte: new Date(date.getTime() - 3600000), lte: new Date(date.getTime() + 3600000) },
        accountId: account.id,
      },
    });
    if (existing) return;

    await prisma.transaction.create({
      data: {
        accountId: account.id,
        amount,
        currency,
        description: `PayPal ${event_type}`,
        merchant: resource?.payee?.email_address ?? null,
        date,
        source: "API",
        category: "Transferencias",
        rawData: resource as object,
      },
    });

    console.log(`[webhook/paypal] ${event_type} imported`);
  } catch (err) {
    console.error("[webhook/paypal] Processing error:", err);
  }
});

async function verifyPayPalWebhook(req: Request): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  // Skip full verification in dev if credentials not set
  if (!webhookId || !clientId || !clientSecret) return true;

  try {
    const tokenResp = await fetch(
      `https://api-m.${process.env.PAYPAL_SANDBOX === "true" ? "sandbox." : ""}paypal.com/v1/oauth2/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        },
        body: "grant_type=client_credentials",
      }
    );

    const { access_token } = (await tokenResp.json()) as { access_token: string };

    const verifyResp = await fetch(
      `https://api-m.${process.env.PAYPAL_SANDBOX === "true" ? "sandbox." : ""}paypal.com/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access_token}`,
        },
        body: JSON.stringify({
          auth_algo: req.headers["paypal-auth-algo"],
          cert_url: req.headers["paypal-cert-url"],
          transmission_id: req.headers["paypal-transmission-id"],
          transmission_sig: req.headers["paypal-transmission-sig"],
          transmission_time: req.headers["paypal-transmission-time"],
          webhook_id: webhookId,
          webhook_event: req.body,
        }),
      }
    );

    const result = (await verifyResp.json()) as { verification_status: string };
    return result.verification_status === "SUCCESS";
  } catch (err) {
    console.error("[webhook/paypal] Verification error:", err);
    return false;
  }
}

// ── Wise ──────────────────────────────────────────────────────────────────────

webhooksRouter.post("/wise", async (req: Request, res: Response) => {
  if (!verifyWiseSignature(req)) {
    console.warn("[webhook/wise] Signature verification failed");
    res.sendStatus(401);
    return;
  }

  res.sendStatus(200);

  const { event_type, data } = req.body as {
    event_type: string;
    data?: {
      resource?: {
        id?: number;
        type?: string;
        profile_id?: number;
      };
    };
  };

  if (event_type !== "transfers#state-change") return;
  if (!data?.resource?.id) return;

  try {
    await processWiseTransfer(data.resource.id);
  } catch (err) {
    console.error("[webhook/wise] Processing error:", err);
  }
});

function verifyWiseSignature(req: Request): boolean {
  const publicKey = process.env.WISE_WEBHOOK_PUBLIC_KEY;
  if (!publicKey) return true; // skip in dev

  const signature = req.headers["x-signature-sha256"] as string | undefined;
  if (!signature) return false;

  try {
    const rawBody =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    const verifier = crypto.createVerify("SHA256");
    verifier.update(rawBody);
    return verifier.verify(publicKey, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}

async function processWiseTransfer(transferId: number) {
  const apiToken = process.env.WISE_API_TOKEN;
  if (!apiToken) {
    console.warn("[webhook/wise] WISE_API_TOKEN not set");
    return;
  }

  const resp = await fetch(`https://api.wise.com/v1/transfers/${transferId}`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });

  if (!resp.ok) {
    console.error(`[webhook/wise] Failed to fetch transfer ${transferId}: ${resp.status}`);
    return;
  }

  const transfer = (await resp.json()) as {
    status: string;
    sourceCurrency: string;
    sourceValue: number;
    targetCurrency: string;
    targetValue: number;
    details?: { reference?: string };
    created?: string;
  };

  if (transfer.status !== "outgoing_payment_sent") return;

  const account = await prisma.account.findFirst({ where: { provider: "WISE" } });
  if (!account) return;

  const amount = -transfer.sourceValue;
  const date = transfer.created ? new Date(transfer.created) : new Date();

  const existing = await prisma.transaction.findFirst({
    where: {
      amount,
      date: { gte: new Date(date.getTime() - 3600000), lte: new Date(date.getTime() + 3600000) },
      accountId: account.id,
    },
  });
  if (existing) return;

  await prisma.transaction.create({
    data: {
      accountId: account.id,
      amount,
      currency: transfer.sourceCurrency,
      description: transfer.details?.reference ?? `Wise transfer #${transferId}`,
      date,
      source: "API",
      category: "Transferencias",
      rawData: transfer as object,
    },
  });

  console.log(`[webhook/wise] Transfer ${transferId} imported`);
}
