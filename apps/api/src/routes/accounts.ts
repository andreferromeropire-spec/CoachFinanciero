import { Router, Request, Response } from "express";
import { prisma } from "@coach/db";

export const accountsRouter = Router();

accountsRouter.get("/", async (_req: Request, res: Response) => {
  const accounts = await prisma.account.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { transactions: true } },
    },
  });
  res.json(accounts);
});

accountsRouter.post("/", async (req: Request, res: Response) => {
  const { name, type, currency, balance, provider } = req.body;
  if (!name || !type || !provider) {
    res.status(400).json({ error: "name, type and provider are required" });
    return;
  }
  const account = await prisma.account.create({
    data: { name, type, currency: currency ?? "ARS", balance: balance ?? 0, provider },
  });
  res.status(201).json(account);
});

accountsRouter.patch("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, balance, currency } = req.body;
  try {
    const account = await prisma.account.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(balance !== undefined && { balance }),
        ...(currency !== undefined && { currency }),
      },
    });
    res.json(account);
  } catch {
    res.status(404).json({ error: "Account not found" });
  }
});

accountsRouter.delete("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.account.delete({ where: { id } });
    res.sendStatus(204);
  } catch {
    res.status(404).json({ error: "Account not found" });
  }
});
