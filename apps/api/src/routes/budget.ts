import { Router, Request, Response } from "express";
import { prisma } from "@coach/db";
import { budgetEngine } from "../services/BudgetEngine";

export const budgetRouter = Router();

budgetRouter.get("/summary", async (req: Request, res: Response) => {
  const period = (req.query.period as string) ?? "current_month";
  const summary = await budgetEngine.getSummary(
    period as "current_month" | "last_month" | "last_3_months"
  );
  res.json(summary);
});

budgetRouter.get("/categories/status", async (_req: Request, res: Response) => {
  const status = await budgetEngine.getCategoryBudgetStatus();
  res.json(status);
});

budgetRouter.get("/can-afford", async (req: Request, res: Response) => {
  const amount = parseFloat((req.query.amount as string) ?? "0");
  const description = req.query.description as string | undefined;
  const result = await budgetEngine.canAfford(amount, description);
  res.json(result);
});

budgetRouter.get("/can-afford-installments", async (req: Request, res: Response) => {
  const total = parseFloat((req.query.total as string) ?? "0");
  const installments = parseInt((req.query.installments as string) ?? "1", 10);
  const result = await budgetEngine.canAffordInInstallments(total, installments);
  res.json(result);
});

budgetRouter.get("/projection", async (req: Request, res: Response) => {
  const months = Math.min(24, parseInt((req.query.months as string) ?? "6", 10));
  const result = await budgetEngine.getProjection(months);
  res.json(result);
});

budgetRouter.get("/time-to-save", async (req: Request, res: Response) => {
  const target = parseFloat((req.query.target as string) ?? "0");
  const result = await budgetEngine.timeToSave(target);
  res.json(result);
});

// ── CRUD ──────────────────────────────────────────────────────────────────────

budgetRouter.get("/", async (_req: Request, res: Response) => {
  const budgets = await prisma.budget.findMany({
    orderBy: { startDate: "desc" },
    include: { budgetCategories: true },
  });
  res.json(budgets);
});

budgetRouter.post("/", async (req: Request, res: Response) => {
  const { name, totalAmount, period, startDate, categories } = req.body;
  if (!name || !totalAmount || !period || !startDate) {
    res.status(400).json({ error: "name, totalAmount, period, startDate required" });
    return;
  }

  const budget = await prisma.budget.create({
    data: {
      name,
      totalAmount,
      period,
      startDate: new Date(startDate),
      categories: categories ?? [],
      budgetCategories: {
        create:
          (categories as { name: string; allocatedAmount: number }[] | undefined)?.map((c) => ({
            name: c.name,
            allocatedAmount: c.allocatedAmount,
          })) ?? [],
      },
    },
    include: { budgetCategories: true },
  });

  res.status(201).json(budget);
});

budgetRouter.patch("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, totalAmount } = req.body;
  try {
    const budget = await prisma.budget.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(totalAmount !== undefined && { totalAmount }),
      },
      include: { budgetCategories: true },
    });
    res.json(budget);
  } catch {
    res.status(404).json({ error: "Budget not found" });
  }
});

budgetRouter.patch("/categories/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { allocatedAmount, spentAmount } = req.body;
  try {
    const cat = await prisma.budgetCategory.update({
      where: { id },
      data: {
        ...(allocatedAmount !== undefined && { allocatedAmount }),
        ...(spentAmount !== undefined && { spentAmount }),
      },
    });
    res.json(cat);
  } catch {
    res.status(404).json({ error: "BudgetCategory not found" });
  }
});
