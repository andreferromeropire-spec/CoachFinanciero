import { prisma } from "@coach/db";
import { budgetEngine } from "../services/BudgetEngine";

export async function runDailyAlerts(): Promise<void> {
  console.log("[cron] Running daily alerts...");

  try {
    await checkBudgetWarnings();
    await checkUncategorized();
    console.log("[cron] Daily alerts done.");
  } catch (err) {
    console.error("[cron] dailyAlerts error:", err);
  }
}

async function checkBudgetWarnings() {
  const statuses = await budgetEngine.getCategoryBudgetStatus();

  for (const cat of statuses) {
    if (cat.status === "ok") continue;

    const title =
      cat.status === "over"
        ? `⚠️ Presupuesto excedido: ${cat.name}`
        : `📊 Alerta de presupuesto: ${cat.name}`;

    const body =
      cat.status === "over"
        ? `Gastaste $${cat.spent.toFixed(0)} de $${cat.allocated.toFixed(0)} (${cat.percent.toFixed(0)}%) en ${cat.name}. Superaste el límite.`
        : `Llegaste al ${cat.percent.toFixed(0)}% del presupuesto de ${cat.name} ($${cat.spent.toFixed(0)}/$${cat.allocated.toFixed(0)}).`;

    // Avoid duplicate notifications for same category today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const existing = await prisma.notification.findFirst({
      where: {
        type: cat.status === "over" ? "BUDGET_OVER" : "BUDGET_WARNING",
        title,
        createdAt: { gte: today },
      },
    });

    if (!existing) {
      await prisma.notification.create({
        data: {
          type: cat.status === "over" ? "BUDGET_OVER" : "BUDGET_WARNING",
          title,
          body,
        },
      });
      console.log(`[cron] Created notification: ${title}`);
    }
  }
}

async function checkUncategorized() {
  const count = await prisma.transaction.count({
    where: {
      category: "Sin categorizar",
      isDuplicate: false,
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  });

  if (count === 0) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const existing = await prisma.notification.findFirst({
    where: { type: "UNCATEGORIZED_REMINDER", createdAt: { gte: today } },
  });

  if (!existing) {
    await prisma.notification.create({
      data: {
        type: "UNCATEGORIZED_REMINDER",
        title: `📂 ${count} transacción${count > 1 ? "es" : ""} sin categorizar`,
        body: `Tienes ${count} transacción${count > 1 ? "es" : ""} sin categorizar de los últimos 7 días. Clasificarlas mejora el análisis de tu coach.`,
      },
    });
  }
}

// ── Cron scheduler (runs every 24h, first run after 1min delay on startup) ──

let cronTimer: ReturnType<typeof setTimeout> | null = null;
const INTERVAL_MS = 24 * 60 * 60 * 1000;

export function startDailyCron() {
  if (process.env.NODE_ENV === "test") return;

  // First run after 1 minute (let the DB settle on startup)
  setTimeout(async () => {
    await runDailyAlerts();
    cronTimer = setInterval(runDailyAlerts, INTERVAL_MS);
  }, 60_000);

  console.log("[cron] Daily alerts scheduled (first run in 1 min, then every 24h)");
}

export function stopDailyCron() {
  if (cronTimer) { clearInterval(cronTimer); cronTimer = null; }
}
