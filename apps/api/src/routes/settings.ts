import { Router, Request, Response } from "express";
import { prisma } from "@coach/db";

export const settingsRouter = Router();

settingsRouter.get("/", async (_req: Request, res: Response) => {
  let settings = await prisma.userSettings.findFirst();
  if (!settings) {
    settings = await prisma.userSettings.create({ data: {} });
  }
  res.json(settings);
});

settingsRouter.patch("/", async (req: Request, res: Response) => {
  const {
    monthlyIncomeAvg,
    savingsGoalPercent,
    maxInstallmentPercent,
    sonnetCallsLimit,
  } = req.body;

  let settings = await prisma.userSettings.findFirst();
  if (!settings) {
    settings = await prisma.userSettings.create({ data: {} });
  }

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
