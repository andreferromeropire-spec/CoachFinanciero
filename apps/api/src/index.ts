import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
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
import { emailsRouter } from "./routes/emails";
import { ratesRouter } from "./routes/rates";
import { authMiddleware } from "./middleware/auth";
import { startDailyCron } from "./jobs/dailyAlerts";

const app = express();
const PORT = process.env.PORT || 4000;

// Falla rápido si faltan secrets críticos en producción
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  console.error("[api] ✗ JWT_SECRET no configurado. La aplicación no puede iniciar en producción.");
  process.exit(1);
}

/** Railway y proxies — IP real para rate limit */
app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
}));

const err429 = (code: string) => (_req: express.Request, res: express.Response) => {
  res.status(429).json({
    error: "Demasiados intentos. Probá de nuevo en unos minutos.",
    code,
  });
};

const globalApiLimiter = rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: err429("RATE_LIMIT_GLOBAL"),
});

const authApiLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: err429("RATE_LIMIT_AUTH"),
});

const coachApiLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: err429("RATE_LIMIT_COACH"),
});

const ingestApiLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  handler: err429("RATE_LIMIT_INGEST"),
});

const allowedOrigins = [
  process.env.PUBLIC_WEB_URL,
  "https://coachfinanciero.pages.dev",
  "http://localhost:3000",
  "http://192.168.1.4:3000",
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) { callback(null, true); return; }
    // Acepta dominio exacto o cualquier subdominio de pages.dev (previews de Cloudflare)
    const isAllowed =
      allowedOrigins.includes(origin) ||
      /^https:\/\/[a-z0-9-]+\.pages\.dev$/.test(origin);
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

app.use("/api", globalApiLimiter);

// Raw body for webhook signature verification (must come before express.json)
app.use("/api/webhooks", express.raw({ type: "application/json" }), (req, _res, next) => {
  if (Buffer.isBuffer(req.body)) {
    req.body = JSON.parse(req.body.toString("utf-8"));
  }
  next();
});

app.use(express.json({ limit: "5mb" }));

// Auth routes (no auth middleware needed) — 10 req/min
app.use("/api/auth", authApiLimiter, authRouter);

// Apply auth middleware to all other API routes
app.use("/api", authMiddleware);

app.use("/api/health", healthRouter);
app.use("/api/ingest", ingestApiLimiter, ingestRouter);
app.use("/api/webhooks", webhooksRouter);
app.use("/api/accounts", accountsRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/budget", budgetRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/coach", coachApiLimiter, coachRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/emails", emailsRouter);
app.use("/api/rates", ratesRouter);

// Global error handler — 4 parámetros obligatorios para que Express lo reconozca
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[api] Error no manejado:", err.message ?? err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Error interno del servidor", code: "INTERNAL_ERROR" });
  }
});

app.listen(PORT, () => {
  console.log(`[api] ✓ Server running on http://localhost:${PORT}`);
  console.log(`[api]   health | ingest/(email,csv,imap) | webhooks/(mp,paypal,wise)`);
  console.log(`[api]   accounts | transactions | budget | settings | coach | notifications | analytics`);
  {
    const key  = (process.env.RESEND_API_KEY ?? "").trim();
    const from = (process.env.RESEND_FROM ?? "").trim();
    const usaPrueba = !from || /onboarding@resend\.dev/i.test(from) || from.includes("resend.dev");
    if (key) {
      console.log(
        `[api]   Resend: clave = sí, remitente = "${from || "(vacío)"}"`,
        usaPrueba
          ? "— si ves 403, definí en Railway RESEND_FROM con notificaciones@TUDOMINIO verificado (no dejes onboarding@resend.dev)."
          : "(dominio propio)",
      );
    } else {
      console.log(`[api]   Resend: clave = no (mail de recuperar contraseña desactivado)`);
    }
  }
  startDailyCron();
});

export default app;
