import "dotenv/config";
import express from "express";
import cors from "cors";
import { healthRouter } from "./routes/health";
import { ingestRouter } from "./routes/ingest";
import { webhooksRouter } from "./routes/webhooks";
import { accountsRouter } from "./routes/accounts";
import { transactionsRouter } from "./routes/transactions";
import { budgetRouter } from "./routes/budget";
import { settingsRouter } from "./routes/settings";
import { coachRouter } from "./routes/coach";
import { notificationsRouter } from "./routes/notifications";
import { analyticsRouter } from "./routes/analytics";
import { authRouter } from "./routes/auth";
import { authMiddleware } from "./middleware/auth";
import { startDailyCron } from "./jobs/dailyAlerts";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: [process.env.PUBLIC_WEB_URL, "http://localhost:3000"].filter(Boolean) as string[],
  credentials: true,
}));

// Raw body for webhook signature verification (must come before express.json)
app.use("/api/webhooks", express.raw({ type: "application/json" }), (req, _res, next) => {
  if (Buffer.isBuffer(req.body)) {
    req.body = JSON.parse(req.body.toString("utf-8"));
  }
  next();
});

app.use(express.json({ limit: "5mb" }));

// Auth routes (no auth middleware needed)
app.use("/api/auth", authRouter);

// Apply auth middleware to all other API routes
app.use("/api", authMiddleware);

app.use("/api/health", healthRouter);
app.use("/api/ingest", ingestRouter);
app.use("/api/webhooks", webhooksRouter);
app.use("/api/accounts", accountsRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/budget", budgetRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/coach", coachRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/analytics", analyticsRouter);

app.listen(PORT, () => {
  console.log(`[api] ✓ Server running on http://localhost:${PORT}`);
  console.log(`[api]   health | ingest/(email,csv,imap) | webhooks/(mp,paypal,wise)`);
  console.log(`[api]   accounts | transactions | budget | settings | coach | notifications | analytics`);
  startDailyCron();
});

export default app;
