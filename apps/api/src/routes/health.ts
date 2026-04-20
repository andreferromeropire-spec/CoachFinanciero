import { Router, Request, Response } from "express";
import { prisma } from "@coach/db";

export const healthRouter = Router();

healthRouter.get("/", async (_req: Request, res: Response) => {
  let dbStatus = "disconnected";
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "connected";
  } catch {
    dbStatus = "disconnected";
  }

  res.json({
    status: "ok",
    db: dbStatus,
    timestamp: new Date().toISOString(),
  });
});
