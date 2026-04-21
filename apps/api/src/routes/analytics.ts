import { Router, Request, Response } from "express";
import { prisma } from "@coach/db";
import type { AuthRequest } from "../middleware/auth";

export const analyticsRouter = Router();

function toNum(d: unknown): number {
  if (typeof d === "number") return d;
  if (d && typeof (d as { toString: () => string }).toString === "function") return Number((d as { toString: () => string }).toString());
  return 0;
}

// ── GET /api/analytics/monthly?year=2025 ─────────────────────────────────────

analyticsRouter.get("/monthly", async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId ?? "default-user";
  const year = parseInt((req.query.year as string) ?? new Date().getFullYear().toString());

  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59);

  const txs = await prisma.transaction.findMany({
    where: { userId, isDuplicate: false, date: { gte: start, lte: end } },
    select: { amount: true, category: true, merchant: true, merchantNormalized: true, date: true, isShared: true, yourShare: true, sharedStatus: true },
  });

  // Group by month
  const months: Record<number, {
    income: number; expenses: number;
    byCategory: Record<string, number>;
    merchantMap: Record<string, { total: number; count: number }>;
    count: number;
  }> = {};

  for (let m = 0; m < 12; m++) {
    months[m] = { income: 0, expenses: 0, byCategory: {}, merchantMap: {}, count: 0 };
  }

  for (const tx of txs) {
    const m = new Date(tx.date).getMonth();
    let amt = toNum(tx.amount);
    if (tx.isShared && tx.sharedStatus !== "SETTLED" && tx.yourShare !== null) {
      amt = -Math.abs(toNum(tx.yourShare));
    }

    months[m].count++;
    if (amt >= 0) {
      months[m].income += amt;
    } else {
      months[m].expenses += Math.abs(amt);
    }

    const cat = tx.category || "Sin categorizar";
    months[m].byCategory[cat] = (months[m].byCategory[cat] || 0) + Math.abs(amt);

    const name = tx.merchantNormalized ?? tx.merchant;
    if (name) {
      if (!months[m].merchantMap[name]) months[m].merchantMap[name] = { total: 0, count: 0 };
      months[m].merchantMap[name].total += Math.abs(amt);
      months[m].merchantMap[name].count++;
    }
  }

  const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  const result = Object.entries(months).map(([mStr, data]) => {
    const m = parseInt(mStr);
    const savings = data.income - data.expenses;
    const savingsRate = data.income > 0 ? (savings / data.income) * 100 : 0;
    const topMerchants = Object.entries(data.merchantMap)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([name, v]) => ({ name, amount: Math.round(v.total), count: v.count }));
    const byCategory = Object.entries(data.byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => ({ name, amount: Math.round(amount) }));

    return {
      month: MONTH_NAMES[m],
      monthIndex: m,
      year,
      income: Math.round(data.income),
      expenses: Math.round(data.expenses),
      savings: Math.round(savings),
      savingsRate: parseFloat(savingsRate.toFixed(1)),
      byCategory,
      topMerchants,
      transactionCount: data.count,
    };
  });

  res.json(result);
});

// ── GET /api/analytics/yearly ─────────────────────────────────────────────────

analyticsRouter.get("/yearly", async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId ?? "default-user";
  const currentYear = new Date().getFullYear();

  const oldest = await prisma.transaction.aggregate({
    where: { userId, isDuplicate: false },
    _min: { date: true },
  });

  // Siempre el mismo criterio de pestañas: al menos 15 años hacia atrás desde hoy, y si hay datos más
  // viejos se incluyen. Así Historia no queda en solo 3 años cuando todavía no hay movimientos en la DB.
  let minY = currentYear - 15;
  if (oldest._min.date) {
    const dataMinY = new Date(oldest._min.date).getFullYear();
    minY = Math.min(dataMinY, minY);
  }
  const maxSpan = 40;
  if (currentYear - minY > maxSpan - 1) minY = currentYear - (maxSpan - 1);

  const years: number[] = [];
  for (let y = minY; y <= currentYear; y++) years.push(y);

  const results = [];

  for (const year of years) {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59);

    const txs = await prisma.transaction.findMany({
      where: { userId, isDuplicate: false, date: { gte: start, lte: end } },
      select: { amount: true, isShared: true, yourShare: true, sharedStatus: true },
    });

    let income = 0;
    let expenses = 0;
    for (const tx of txs) {
      let amt = toNum(tx.amount);
      if (tx.isShared && tx.sharedStatus !== "SETTLED" && tx.yourShare !== null) {
        amt = -Math.abs(toNum(tx.yourShare));
      }
      if (amt >= 0) income += amt;
      else expenses += Math.abs(amt);
    }

    results.push({
      year,
      income: Math.round(income),
      expenses: Math.round(expenses),
      savings: Math.round(income - expenses),
      savingsRate: income > 0 ? parseFloat(((income - expenses) / income * 100).toFixed(1)) : 0,
      transactionCount: txs.length,
    });
  }

  res.json(results);
});

// ── GET /api/analytics/trends ─────────────────────────────────────────────────

analyticsRouter.get("/trends", async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId ?? "default-user";
  const now = new Date();
  const oldest = await prisma.transaction.aggregate({
    where: { userId, isDuplicate: false },
    _min: { date: true },
  });
  const minDate = oldest._min.date ? new Date(oldest._min.date) : new Date(now.getFullYear() - 2, now.getMonth(), 1);
  const capOld = new Date(now.getFullYear() - 15, 0, 1);
  const since = minDate < capOld ? capOld : minDate;

  const txs = await prisma.transaction.findMany({
    where: { userId, isDuplicate: false, date: { gte: since } },
    select: { amount: true, category: true, date: true, isShared: true, yourShare: true, sharedStatus: true },
    orderBy: { date: "asc" },
  });

  // Build month-by-month
  type MonthKey = string;
  const monthMap: Record<MonthKey, { income: number; expenses: number; byCategory: Record<string, number> }> = {};

  for (const tx of txs) {
    const d = new Date(tx.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    if (!monthMap[key]) monthMap[key] = { income: 0, expenses: 0, byCategory: {} };

    let amt = toNum(tx.amount);
    if (tx.isShared && tx.sharedStatus !== "SETTLED" && tx.yourShare !== null) {
      amt = -Math.abs(toNum(tx.yourShare));
    }

    if (amt >= 0) monthMap[key].income += amt;
    else {
      monthMap[key].expenses += Math.abs(amt);
      const cat = tx.category ?? "Sin categorizar";
      monthMap[key].byCategory[cat] = (monthMap[key].byCategory[cat] || 0) + Math.abs(amt);
    }
  }

  const months = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b));

  let bestMonth = { key: "", savings: -Infinity };
  let worstMonth = { key: "", expenses: -Infinity };
  let totalSavings = 0;
  let totalExpenses = 0;
  let monthsWithData = 0;

  for (const [key, data] of months) {
    const savings = data.income - data.expenses;
    if (savings > bestMonth.savings) bestMonth = { key, savings };
    if (data.expenses > worstMonth.expenses) worstMonth = { key: key, expenses: data.expenses };
    totalSavings += savings;
    totalExpenses += data.expenses;
    monthsWithData++;
  }

  // Best saving streak
  let bestStreak = 0;
  let currentStreak = 0;
  for (const [, data] of months) {
    if (data.income > data.expenses) {
      currentStreak++;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  // Category trends: compare last 3 months vs 3 months before
  const cutoff3 = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const cutoff6 = new Date(now.getFullYear(), now.getMonth() - 6, 1);

  const recent3 = months.filter(([k]) => k >= cutoff3.toISOString().slice(0, 7));
  const prev3 = months.filter(([k]) => k >= cutoff6.toISOString().slice(0, 7) && k < cutoff3.toISOString().slice(0, 7));

  const sumCat = (data: typeof months, cat: string) => data.reduce((s, [, d]) => s + (d.byCategory[cat] ?? 0), 0);

  const allCats = new Set(months.flatMap(([, d]) => Object.keys(d.byCategory)));
  const categoryTrends = Array.from(allCats).map((cat) => {
    const recentAmt = sumCat(recent3, cat) / Math.max(1, recent3.length);
    const prevAmt = sumCat(prev3, cat) / Math.max(1, prev3.length);
    const change = prevAmt > 0 ? ((recentAmt - prevAmt) / prevAmt) * 100 : 0;
    return { category: cat, recentMonthlyAvg: Math.round(recentAmt), change: parseFloat(change.toFixed(1)), trend: change > 5 ? "up" as const : change < -5 ? "down" as const : "stable" as const };
  }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 8);

  const parseKey = (key: string) => {
    const [y, m] = key.split("-");
    const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    return { month: MONTH_NAMES[parseInt(m) - 1], year: parseInt(y) };
  };

  res.json({
    bestMonth: bestMonth.key ? { ...parseKey(bestMonth.key), savings: Math.round(bestMonth.savings) } : null,
    worstMonth: worstMonth.key ? { ...parseKey(worstMonth.key), expenses: Math.round(worstMonth.expenses) } : null,
    avgMonthlySavings: monthsWithData > 0 ? Math.round(totalSavings / monthsWithData) : 0,
    avgMonthlyExpenses: monthsWithData > 0 ? Math.round(totalExpenses / monthsWithData) : 0,
    bestSavingsStreak: bestStreak,
    categoryTrends,
    monthlyData: months.map(([key, data]) => ({
      ...parseKey(key),
      key,
      income: Math.round(data.income),
      expenses: Math.round(data.expenses),
      savings: Math.round(data.income - data.expenses),
    })),
  });
});
