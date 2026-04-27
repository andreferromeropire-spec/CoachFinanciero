import { Router, Request, Response } from "express";
import { prisma } from "@coach/db";

export const transactionsRouter = Router();

const PAGE_SIZE = 20;

transactionsRouter.get("/", async (req: Request, res: Response) => {
  const {
    accountId,
    category,
    from,
    to,
    source,
    page = "1",
    search,
  } = req.query as Record<string, string | undefined>;

  const pageNum = Math.max(1, parseInt(page ?? "1", 10));
  const skip = (pageNum - 1) * PAGE_SIZE;

  const { showIgnored } = req.query as Record<string, string | undefined>;

  const where = {
    isDuplicate: false,
    ...(showIgnored !== "true" && { isIgnored: false }),
    ...(accountId && { accountId }),
    ...(category && { category }),
    ...(source && { source: source as "API" | "EMAIL" | "CSV" | "MANUAL" }),
    ...(from || to
      ? {
          date: {
            ...(from && { gte: new Date(from) }),
            ...(to && { lte: new Date(to) }),
          },
        }
      : {}),
    ...(search && {
      OR: [
        { description: { contains: search, mode: "insensitive" as const } },
        { merchant: { contains: search, mode: "insensitive" as const } },
        { category: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { date: "desc" },
      skip,
      take: PAGE_SIZE,
      include: { account: { select: { name: true, provider: true } } },
    }),
    prisma.transaction.count({ where }),
  ]);

  res.json({
    data: transactions,
    meta: { total, page: pageNum, pageSize: PAGE_SIZE, totalPages: Math.ceil(total / PAGE_SIZE) },
  });
});

transactionsRouter.patch("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { category, description, isInternalTransfer, isIgnored } = req.body;
  try {
    const tx = await prisma.transaction.update({
      where: { id },
      data: {
        ...(category !== undefined && { category }),
        ...(description !== undefined && { description }),
        ...(isInternalTransfer !== undefined && { isInternalTransfer }),
        ...(isIgnored !== undefined && { isIgnored }),
      },
    });
    res.json(tx);
  } catch {
    res.status(404).json({ error: "Transaction not found" });
  }
});

// ── PATCH /api/transactions/:id/shared — marcar como gasto compartido ────────

transactionsRouter.patch("/:id/shared", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { isShared, sharedWith } = req.body as { isShared?: boolean; sharedWith?: number };

  if (!isShared || !sharedWith || sharedWith < 2) {
    res.status(400).json({ error: "isShared must be true and sharedWith must be >= 2" });
    return;
  }

  try {
    const tx = await prisma.transaction.findUnique({ where: { id } });
    if (!tx) { res.status(404).json({ error: "Transaction not found" }); return; }

    const fullAmount = Math.abs(Number(tx.amount.toString()));
    const yourShare = fullAmount / sharedWith;

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        isShared: true,
        sharedWith,
        sharedStatus: "PENDING",
        yourShare,
      },
    });

    // Crear notificación
    const fmt = (n: number) => `$${Math.round(n).toLocaleString("es")}`;
    await prisma.notification.create({
      data: {
        type: "SHARED_EXPENSE",
        title: "Gasto compartido pendiente",
        body: `Tienes ${fmt(fullAmount - yourShare)} pendiente de cobro por "${tx.description ?? "gasto compartido"}" (entre ${sharedWith} personas, tu parte: ${fmt(yourShare)}).`,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("[transactions] shared error:", err);
    res.status(500).json({ error: "Error updating shared status" });
  }
});

// ── POST /api/transactions/:id/shared/settle — registrar cobro parcial/total ─

transactionsRouter.post("/:id/shared/settle", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { amountReceived } = req.body as { amountReceived?: number };

  if (amountReceived === undefined || amountReceived < 0) {
    res.status(400).json({ error: "amountReceived is required and must be >= 0" });
    return;
  }

  try {
    const tx = await prisma.transaction.findUnique({ where: { id } });
    if (!tx) { res.status(404).json({ error: "Transaction not found" }); return; }
    if (!tx.isShared) { res.status(400).json({ error: "Transaction is not marked as shared" }); return; }

    const fullAmount = Math.abs(Number(tx.amount.toString()));
    const currentShare = tx.yourShare ? Math.abs(Number(tx.yourShare.toString())) : fullAmount;
    const amountOwed = fullAmount - currentShare;
    const remaining = Math.max(0, amountOwed - amountReceived);
    const newYourShare = currentShare + amountReceived;

    let sharedStatus: "SETTLED" | "PARTIALLY_PAID";
    if (remaining <= 0.01) {
      sharedStatus = "SETTLED";
    } else {
      sharedStatus = "PARTIALLY_PAID";
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: { sharedStatus, yourShare: newYourShare },
    });

    res.json({ ...updated, amountOwed, amountReceived, remaining, sharedStatus });
  } catch (err) {
    console.error("[transactions] settle error:", err);
    res.status(500).json({ error: "Error settling shared expense" });
  }
});

// ── GET /api/transactions/shared/pending — gastos compartidos pendientes ──────

transactionsRouter.get("/shared/pending", async (_req: Request, res: Response) => {
  const txs = await prisma.transaction.findMany({
    where: { isShared: true, sharedStatus: { not: "SETTLED" } },
    orderBy: { date: "desc" },
    include: { account: { select: { name: true } } },
  });

  const totalPending = txs.reduce((sum, tx) => {
    const full = Math.abs(Number(tx.amount.toString()));
    const share = tx.yourShare ? Math.abs(Number(tx.yourShare.toString())) : full;
    return sum + (full - share);
  }, 0);

  res.json({ data: txs, totalPending });
});
