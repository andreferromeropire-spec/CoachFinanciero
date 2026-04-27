import { Router, Request, Response } from "express";
import { getLatestRate, snapshotRate, getRateHistory } from "../services/RateService";

export const ratesRouter = Router();

ratesRouter.get("/latest", async (_req: Request, res: Response) => {
  try {
    const rate = await getLatestRate();
    res.json(rate);
  } catch {
    res.status(502).json({ error: "No se pudo obtener la cotización", code: "RATE_FETCH_ERROR" });
  }
});

ratesRouter.post("/snapshot", async (_req: Request, res: Response) => {
  try {
    const row = await snapshotRate();
    res.json(row);
  } catch {
    res.status(502).json({ error: "No se pudo guardar la cotización", code: "RATE_SNAPSHOT_ERROR" });
  }
});

ratesRouter.get("/history", async (req: Request, res: Response) => {
  const days = Math.min(Number(req.query.days) || 30, 365);
  try {
    const rows = await getRateHistory(days);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Error al obtener historial", code: "RATE_HISTORY_ERROR" });
  }
});
