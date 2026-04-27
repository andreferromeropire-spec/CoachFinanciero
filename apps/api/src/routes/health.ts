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

  const isProd = process.env.NODE_ENV === "production";
  res.json({
    status: dbStatus === "connected" ? "ok" : "degraded",
    db: dbStatus,
    // En producción solo exponemos el estado, no detalles internos
    ...(!isProd && {
      userQuery: userQueryStatus,
      userCount,
      errorDetail: errorDetail || undefined,
    }),
    timestamp: new Date().toISOString(),
  });
});
