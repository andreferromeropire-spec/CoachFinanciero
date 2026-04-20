import { Router, Request, Response } from "express";
import { prisma } from "@coach/db";
import type { AuthRequest } from "../middleware/auth";

export const settingsRouter = Router();

function getUserId(req: Request): string {
  return (req as AuthRequest).userId ?? "default-user";
}

async function getOrCreateSettings(userId: string) {
  let settings = await prisma.userSettings.findFirst({ where: { userId } });
  if (!settings) {
    settings = await prisma.userSettings.create({ data: { userId } });
  }
  return settings;
}

settingsRouter.get("/", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const settings = await getOrCreateSettings(userId);
  res.json(settings);
});

settingsRouter.patch("/", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const {
    monthlyIncomeAvg,
    savingsGoalPercent,
    maxInstallmentPercent,
    sonnetCallsLimit,
  } = req.body;

  const settings = await getOrCreateSettings(userId);

  const updated = await prisma.userSettings.update({
    where: { id: settings.id },
    data: {
      ...(monthlyIncomeAvg !== undefined && { monthlyIncomeAvg }),
      ...(savingsGoalPercent !== undefined && { savingsGoalPercent }),
      ...(maxInstallmentPercent !== undefined && { maxInstallmentPercent }),
      ...(sonnetCallsLimit !== undefined && { sonnetCallsLimit }),
    },
  });

  res.json(updated);
});

// ── PATCH /api/settings/onboarding-complete ───────────────────────────────────

settingsRouter.patch("/onboarding-complete", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const {
    gmailConnected,
    webhookMpConfigured,
    webhookPaypalConfigured,
    webhookWiseConfigured,
  } = req.body ?? {};

  const settings = await getOrCreateSettings(userId);

  const updated = await prisma.userSettings.update({
    where: { id: settings.id },
    data: {
      onboardingCompleted: true,
      ...(gmailConnected !== undefined && { gmailConnected }),
      ...(webhookMpConfigured !== undefined && { webhookMpConfigured }),
      ...(webhookPaypalConfigured !== undefined && { webhookPaypalConfigured }),
      ...(webhookWiseConfigured !== undefined && { webhookWiseConfigured }),
    },
  });

  res.json(updated);
});

// ── GET /api/settings/ingest-email ────────────────────────────────────────────

settingsRouter.get("/ingest-email", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  // Deterministic ingest address derived from userId
  const base = process.env.INGEST_EMAIL_DOMAIN ?? "ingest.coachfinanciero.app";
  const localPart = `ingest+${userId.replace(/[^a-z0-9]/gi, "")}`;
  res.json({ email: `${localPart}@${base}` });
});

// ── POST /api/settings/imap/test ──────────────────────────────────────────────

settingsRouter.post("/imap/test", async (req: Request, res: Response) => {
  const { host, port, user, password } = req.body as {
    host?: string; port?: number; user?: string; password?: string;
  };

  if (!user || !password) {
    res.status(400).json({ error: "user and password are required" });
    return;
  }

  try {
    // Dynamically import imap-simple to avoid top-level import issues
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const imapSimple = require("imap-simple") as typeof import("imap-simple");

    const config = {
      imap: {
        host: host ?? process.env.IMAP_HOST ?? "imap.gmail.com",
        port: port ?? parseInt(process.env.IMAP_PORT ?? "993"),
        user,
        password,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 8000,
      },
    };

    const connection = await imapSimple.connect(config);
    await connection.openBox("INBOX");
    connection.end();

    res.json({ ok: true, message: "Conexión IMAP exitosa" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(422).json({ ok: false, error: msg });
  }
});
