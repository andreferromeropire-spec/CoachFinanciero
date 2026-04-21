import { Router, Request, Response } from "express";
import { prisma } from "@coach/db";
import type { AuthRequest } from "../middleware/auth";
import { importGmailHistory } from "../services/GmailImportService";

export const emailsRouter = Router();

function uid(req: Request) {
  return (req as AuthRequest).userId ?? "default-user";
}

// GET /api/emails — lista cuentas Gmail conectadas
emailsRouter.get("/", async (req: Request, res: Response) => {
  const userId = uid(req);
  const accounts = await prisma.connectedEmail.findMany({
    where: { userId },
    select: {
      id: true, email: true, provider: true,
      lastImportAt: true, createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  res.json(accounts);
});

// DELETE /api/emails/:id — desconectar una cuenta
emailsRouter.delete("/:id", async (req: Request, res: Response) => {
  const userId = uid(req);
  const { id } = req.params;
  try {
    await prisma.connectedEmail.deleteMany({ where: { id, userId } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Not found" });
  }
});

// POST /api/emails/:id/import — importar historial de esa cuenta (SSE)
emailsRouter.post("/:id/import", async (req: Request, res: Response) => {
  const userId = uid(req);
  const { id } = req.params;
  const { since, maxEmails = 100 } = req.body as { since?: string; maxEmails?: number };

  const account = await prisma.connectedEmail.findFirst({ where: { id, userId } });
  if (!account) {
    res.status(404).json({ error: "Cuenta no encontrada" });
    return;
  }

  // Server-Sent Events para progreso en tiempo real
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  function send(data: object) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  try {
    const result = await importGmailHistory({
      accountId: account.id,
      userId,
      accessToken: account.accessToken,
      refreshToken: account.refreshToken ?? undefined,
      email: account.email,
      since: since ? new Date(since) : undefined,
      maxEmails,
      onProgress: (msg: string) => send({ type: "progress", message: msg }),
    });

    // Actualizar lastImportAt
    await prisma.connectedEmail.update({
      where: { id: account.id },
      data:  { lastImportAt: new Date() },
    });

    send({ type: "done", ...result });
    res.end();
  } catch (err) {
    send({ type: "error", message: String(err) });
    res.end();
  }
});
