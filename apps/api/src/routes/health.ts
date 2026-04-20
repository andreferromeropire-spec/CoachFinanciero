import { Router, Request, Response } from "express";
import { prisma } from "@coach/db";

export const healthRouter = Router();

healthRouter.get("/", async (_req: Request, res: Response) => {
  let dbStatus = "disconnected";
  let userQueryStatus = "untested";
  let userCount = -1;
  let errorDetail = "";

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "connected";
  } catch (e) {
    dbStatus = "disconnected";
    errorDetail = String(e);
  }

  if (dbStatus === "connected") {
    try {
      userCount = await prisma.user.count();
      userQueryStatus = "ok";
    } catch (e) {
      userQueryStatus = "error";
      errorDetail = String(e);
    }
  }

  res.json({
    status: "ok",
    db: dbStatus,
    userQuery: userQueryStatus,
    userCount,
    errorDetail: errorDetail || undefined,
    timestamp: new Date().toISOString(),
  });
});
