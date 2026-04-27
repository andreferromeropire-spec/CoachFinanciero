import { prisma } from "@coach/db";
import { Decimal } from "@prisma/client/runtime/library";
import { RULES } from "./financialRules";

type Period = "current_month" | "last_month" | "last_3_months";

function periodRange(period: Period): { start: Date; end: Date } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (period) {
    case "current_month":
      return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0, 23, 59, 59) };
    case "last_month":
      return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0, 23, 59, 59) };
    case "last_3_months":
      return { start: new Date(y, m - 3, 1), end: new Date(y, m + 1, 0, 23, 59, 59) };
  }
}

function toNum(d: Decimal | number): number {
  return typeof d === "number" ? d : Number(d.toString());
}

export interface SummaryResult {
  totalIncome: number;
  totalExpenses: number;
  byCategory: Record<string, number>;
  balance: number;
  topMerchants: { merchant: string; total: number }[];
  dailyAverage: number;
}

export interface AffordResult {
  canAfford: boolean;
  availableBalance: number;
  impact: "low" | "medium" | "high";
  message: string;
}

export interface InstallmentResult {
  monthlyPayment: number;
  currentInstallmentsTotal: number;
  newTotal: number;
  withinLimit: boolean;
  limitPercent: number;
  recommendation: string;
}

export interface ProjectionMonth {
  month: string;
  projectedBalance: number;
}

export interface TimeToSaveResult {
  months: number;
  targetDate: Date;
  requiredMonthlySaving: number;
  currentMonthlySaving: number;
  feasible: boolean;
}

export interface CategoryBudgetStatus {
  id: string;
  name: string;
  spent: number;
  allocated: number;
  percent: number;
  status: "ok" | "warning" | "over";
}

export class BudgetEngine {
  async getSummary(period: Period = "current_month"): Promise<SummaryResult> {
    const { start, end } = periodRange(period);

    const txs = await prisma.transaction.findMany({
      where: { date: { gte: start, lte: end }, isDuplicate: false, isIgnored: false, isInternalTransfer: false },
      select: { amount: true, category: true, merchant: true, merchantNormalized: true, date: true, isShared: true, sharedStatus: true, yourShare: true },
    });

    let totalIncome = 0;
    let totalExpenses = 0;
    const byCategory: Record<string, number> = {};
    const merchantMap: Record<string, number> = {};

    for (const tx of txs) {
      let amt = toNum(tx.amount);
      // Use yourShare for shared expenses that aren't fully settled
      if (tx.isShared && tx.sharedStatus !== "SETTLED" && tx.yourShare !== null) {
        amt = -Math.abs(toNum(tx.yourShare));
      }

      if (amt >= 0) {
        totalIncome += amt;
      } else {
        totalExpenses += Math.abs(amt);
      }

      const cat = tx.category || "Sin categorizar";
      byCategory[cat] = (byCategory[cat] || 0) + Math.abs(amt);

      const merchantKey = tx.merchantNormalized ?? tx.merchant;
      if (merchantKey) {
        merchantMap[merchantKey] = (merchantMap[merchantKey] || 0) + Math.abs(amt);
      }
    }

    const topMerchants = Object.entries(merchantMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([merchant, total]) => ({ merchant, total }));

    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    const dailyAverage = totalExpenses / days;

    return {
      totalIncome,
      totalExpenses,
      byCategory,
      balance: totalIncome - totalExpenses,
      topMerchants,
      dailyAverage,
    };
  }

  async canAfford(amount: number, _description?: string): Promise<AffordResult> {
    const accounts = await prisma.account.findMany({ select: { balance: true, currency: true } });
    const arsAccounts = accounts.filter((a) => a.currency === "ARS");
    const availableBalance = arsAccounts.reduce((sum, a) => sum + toNum(a.balance), 0);

    // Pending shared expenses reduce effective balance
    const pendingShared = await prisma.transaction.findMany({
      where: { isShared: true, sharedStatus: { not: "SETTLED" } },
      select: { amount: true, yourShare: true },
    });
    const pendingSharedOwed = pendingShared.reduce((sum, tx) => {
      const full = Math.abs(toNum(tx.amount));
      const share = tx.yourShare !== null ? Math.abs(toNum(tx.yourShare)) : full;
      return sum + (full - share);
    }, 0);
    const effectiveBalance = availableBalance - pendingSharedOwed;

    const { totalExpenses, totalIncome } = await this.getSummary("current_month");
    const monthlyNet = totalIncome - totalExpenses;

    const canAfford = effectiveBalance >= amount;
    const ratio = amount / Math.max(1, effectiveBalance);
    const impact: "low" | "medium" | "high" =
      ratio < 0.1 ? "low" : ratio < 0.3 ? "medium" : "high";

    let message: string;
    if (!canAfford) {
      message = `No tienes saldo suficiente. Necesitas $${amount.toFixed(2)} pero solo tienes $${effectiveBalance.toFixed(2)}.`;
    } else if (impact === "high") {
      message = `Esta compra representa el ${(ratio * 100).toFixed(0)}% de tu saldo disponible — impacto alto.`;
    } else if (impact === "medium") {
      message = `Esta compra representa el ${(ratio * 100).toFixed(0)}% de tu saldo disponible — impacto moderado.`;
    } else {
      message = `Saldo suficiente. Esta compra tiene impacto bajo en tus finanzas.`;
    }

    if (canAfford && monthlyNet < 0) {
      message += ` Atención: este mes estás en negativo (${monthlyNet.toFixed(2)}).`;
    }

    return { canAfford, availableBalance: effectiveBalance, impact, message };
  }

  async canAffordInInstallments(
    totalAmount: number,
    installments: number
  ): Promise<InstallmentResult> {
    const settings = await prisma.userSettings.findFirst();
    const maxInstallmentPercent = settings?.maxInstallmentPercent ?? 30;
    const monthlyIncomeAvg = settings?.monthlyIncomeAvg ? toNum(settings.monthlyIncomeAvg) : null;

    const monthlyPayment = totalAmount / installments;

    // Sum transactions in Finance category last 3 months as proxy for existing installments
    const { start, end } = periodRange("last_3_months");
    const financeTxs = await prisma.transaction.findMany({
      where: {
        date: { gte: start, lte: end },
        category: "Finanzas",
        isDuplicate: false,
        isIgnored: false,
        isInternalTransfer: false,
      },
      select: { amount: true },
    });

    const avgMonthlyFinance =
      financeTxs.reduce((sum, tx) => sum + Math.abs(toNum(tx.amount)), 0) / 3;

    const currentInstallmentsTotal = avgMonthlyFinance;
    const newTotal = currentInstallmentsTotal + monthlyPayment;

    const income = monthlyIncomeAvg ?? (await this.getSummary("current_month")).totalIncome;

    if (income === 0) {
      return {
        monthlyPayment,
        currentInstallmentsTotal: 0,
        newTotal: monthlyPayment,
        withinLimit: false,
        limitPercent: 0,
        recommendation: `Define tu ingreso mensual en **Configuración → Parámetros** para saber si esta cuota cabe en tu presupuesto. (Cuota estimada: $${Math.round(monthlyPayment).toLocaleString("es")}/mes)`,
      };
    }

    const limitAmount = income * (maxInstallmentPercent / 100);
    const withinLimit = newTotal <= limitAmount;
    const limitPercent = (newTotal / income) * 100;

    let recommendation: string;
    if (withinLimit) {
      recommendation = `La cuota de $${monthlyPayment.toFixed(2)}/mes está dentro de tu límite del ${maxInstallmentPercent}% de ingresos.`;
    } else {
      recommendation = `La cuota de $${monthlyPayment.toFixed(2)}/mes llevaría tus compromisos al ${limitPercent.toFixed(0)}% de tus ingresos (límite: ${maxInstallmentPercent}%). No recomendado.`;
    }

    return {
      monthlyPayment,
      currentInstallmentsTotal,
      newTotal,
      withinLimit,
      limitPercent,
      recommendation,
    };
  }

  async getProjection(months: number): Promise<ProjectionMonth[]> {
    const summary3 = await this.getSummary("last_3_months");
    const avgMonthlyIncome = summary3.totalIncome / 3;
    const avgMonthlyExpenses = summary3.totalExpenses / 3;
    const avgNetMonthly = avgMonthlyIncome - avgMonthlyExpenses;

    const accounts = await prisma.account.findMany({ select: { balance: true, currency: true } });
    let currentBalance = accounts
      .filter((a) => a.currency === "ARS")
      .reduce((sum, a) => sum + toNum(a.balance), 0);

    const result: ProjectionMonth[] = [];
    const now = new Date();

    for (let i = 1; i <= months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      currentBalance += avgNetMonthly;
      result.push({
        month: d.toLocaleDateString("es-AR", { year: "numeric", month: "short" }),
        projectedBalance: Math.round(currentBalance * 100) / 100,
      });
    }

    return result;
  }

  async timeToSave(targetAmount: number): Promise<TimeToSaveResult> {
    const summary = await this.getSummary("last_3_months");
    const currentMonthlySaving = (summary.totalIncome - summary.totalExpenses) / 3;

    const settings = await prisma.userSettings.findFirst();
    const savingsGoalPercent = settings?.savingsGoalPercent ?? 20;
    const monthlyIncomeAvg = settings?.monthlyIncomeAvg
      ? toNum(settings.monthlyIncomeAvg)
      : summary.totalIncome / 3;

    const requiredMonthlySaving = monthlyIncomeAvg * (savingsGoalPercent / 100);
    const effectiveSaving = Math.max(currentMonthlySaving, requiredMonthlySaving);

    if (effectiveSaving <= 0) {
      return {
        months: Infinity,
        targetDate: new Date(9999, 0),
        requiredMonthlySaving,
        currentMonthlySaving,
        feasible: false,
      };
    }

    const months = Math.ceil(targetAmount / effectiveSaving);
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + months);

    return {
      months,
      targetDate,
      requiredMonthlySaving,
      currentMonthlySaving,
      feasible: currentMonthlySaving > 0,
    };
  }

  async getCategoryBudgetStatus(): Promise<CategoryBudgetStatus[]> {
    const activeBudget = await prisma.budget.findFirst({
      orderBy: { startDate: "desc" },
      include: { budgetCategories: true },
    });

    if (!activeBudget) return [];

    const { start } = periodRange("current_month");

    const txsByCategory = await prisma.transaction.groupBy({
      by: ["category"],
      where: {
        date: { gte: start },
        isDuplicate: false,
        isIgnored: false,
        isInternalTransfer: false,
        amount: { lt: 0 },
      },
      _sum: { amount: true },
    });

    const spentMap: Record<string, number> = {};
    for (const row of txsByCategory) {
      if (row.category) {
        spentMap[row.category] = Math.abs(toNum(row._sum.amount ?? 0));
      }
    }

    return activeBudget.budgetCategories.map((bc) => {
      const spent = spentMap[bc.name] ?? toNum(bc.spentAmount);
      const allocated = toNum(bc.allocatedAmount);
      const percent = allocated > 0 ? (spent / allocated) * 100 : 0;
      const status: "ok" | "warning" | "over" =
        percent >= 100 ? "over" : percent >= 80 ? "warning" : "ok";

      return { id: bc.id, name: bc.name, spent, allocated, percent, status };
    });
  }
}

export const budgetEngine = new BudgetEngine();

// ── Full affordability analysis result ───────────────────────────────────────

export interface InstallmentOption {
  months: number;
  monthlyPayment: number;
  withinLimit: boolean;
  percentOfIncome: number;
}

export interface CuttingSuggestion {
  category: string;
  currentMonthly: number;
  savingPer20pct: number;
  monthsToSave: number;
}

export type AffordabilityVerdict =
  | "yes_direct_low"
  | "yes_direct_medium"
  | "yes_direct_high"
  | "yes_installments"
  | "save_then_buy"
  | "too_expensive";

export interface FullAffordabilityResult {
  amount: number;
  available: number;
  monthlyIncome: number;
  canAffordDirect: boolean;
  directImpact: "low" | "medium" | "high";
  installmentOptions: InstallmentOption[];
  bestInstallment: InstallmentOption | null;
  cuttingSuggestions: CuttingSuggestion[];
  verdict: AffordabilityVerdict;
  formattedReply: string;
}

// ── BudgetEngine extension: full affordability ────────────────────────────────

export async function fullAffordabilityAnalysis(amount: number): Promise<FullAffordabilityResult> {
  // 1. Available balance (ARS accounts)
  const accounts = await prisma.account.findMany({ select: { balance: true, currency: true } });
  const available = accounts
    .filter((a) => a.currency === "ARS")
    .reduce((sum, a) => sum + (typeof a.balance === "number" ? a.balance : Number(a.balance.toString())), 0);

  // 2. Monthly income
  const settings = await prisma.userSettings.findFirst();
  const summaryNow = await budgetEngine.getSummary("current_month");
  const monthlyIncome = settings?.monthlyIncomeAvg
    ? Number(settings.monthlyIncomeAvg)
    : summaryNow.totalIncome;
  const maxInstallmentBudget = monthlyIncome * (RULES.maxInstallmentPercent / 100);

  // 2b. Detect "app not configured yet"
  const hasAnyData = accounts.length > 0 || summaryNow.totalExpenses > 0 || monthlyIncome > 0;
  if (!hasAnyData) {
    const emptyReply =
      `Para analizar si puedes comprar **$${Math.round(amount).toLocaleString("es")}** necesito conocer tu situación financiera.\n\n` +
      `Para comenzar:\n` +
      `1. Ve a **Configuración → Cuentas** y agrega tu saldo disponible\n` +
      `2. Define tu **ingreso mensual** en Configuración → Parámetros\n` +
      `3. Importa tus transacciones en **Transacciones → Importar CSV**\n\n` +
      `Con esos datos te doy el análisis completo al instante.`;
    return {
      amount, available: 0, monthlyIncome: 0, canAffordDirect: false,
      directImpact: "high", installmentOptions: [], bestInstallment: null,
      cuttingSuggestions: [], verdict: "too_expensive", formattedReply: emptyReply,
    };
  }

  // 3. Direct affordability
  const canAffordDirect = available >= amount;
  const ratio = amount / Math.max(1, available);
  const directImpact: "low" | "medium" | "high" =
    ratio >= RULES.highImpactThreshold ? "high" :
    ratio >= RULES.mediumImpactThreshold ? "medium" : "low";

  // 4. Installment options
  const installmentOptions: InstallmentOption[] = RULES.installmentOptions.map((months) => {
    const monthlyPayment = amount / months;
    const percentOfIncome = monthlyIncome > 0 ? (monthlyPayment / monthlyIncome) * 100 : 999;
    return {
      months,
      monthlyPayment,
      withinLimit: monthlyPayment <= maxInstallmentBudget,
      percentOfIncome,
    };
  });
  const bestInstallment = installmentOptions.find((o) => o.withinLimit) ?? null;

  // 5. Cutting suggestions (only from cuttable categories)
  const byCategory = summaryNow.byCategory;
  const cuttingSuggestions: CuttingSuggestion[] = RULES.cuttableCategories
    .map((cat) => {
      const monthly = byCategory[cat] ?? 0;
      if (monthly === 0) return null;
      const saving = monthly * 0.2;
      const months = saving > 0 ? Math.ceil(amount / saving) : Infinity;
      return { category: cat, currentMonthly: monthly, savingPer20pct: saving, monthsToSave: months };
    })
    .filter((x): x is CuttingSuggestion => x !== null && x.monthsToSave <= RULES.maxReasonableSavingMonths)
    .sort((a, b) => a.monthsToSave - b.monthsToSave)
    .slice(0, 3);

  // 6. Verdict
  let verdict: AffordabilityVerdict;
  if (canAffordDirect && directImpact === "low") verdict = "yes_direct_low";
  else if (canAffordDirect && directImpact === "medium") verdict = "yes_direct_medium";
  else if (canAffordDirect && directImpact === "high") verdict = "yes_direct_high";
  else if (bestInstallment) verdict = "yes_installments";
  else if (cuttingSuggestions.length > 0) verdict = "save_then_buy";
  else verdict = "too_expensive";

  // 7. Build formatted reply (rule-based, zero AI tokens)
  const fmt = (n: number) => `$${Math.round(n).toLocaleString("es")}`;
  const fmtPct = (n: number) => `${n.toFixed(0)}%`;
  const lines: string[] = [];

  lines.push(`💰 **Análisis de compra: ${fmt(amount)}**\n`);

  // Direct
  if (canAffordDirect) {
    const impactLabel = directImpact === "low" ? "✅ Impacto bajo" : directImpact === "medium" ? "⚡ Impacto moderado" : "⚠️ Impacto alto";
    lines.push(`**Al contado:** ${impactLabel} (${fmtPct(ratio * 100)} de tu saldo disponible ${fmt(available)})`);
  } else {
    lines.push(`**Al contado:** ❌ Saldo insuficiente — tienes ${fmt(available)}, te faltan ${fmt(amount - available)}`);
  }

  // Installments
  const viableOptions = installmentOptions.filter((o) => o.withinLimit);
  const blockedOptions = installmentOptions.filter((o) => !o.withinLimit);
  if (monthlyIncome > 0) {
    lines.push(`\n**En cuotas** (límite: ${RULES.maxInstallmentPercent}% de ingresos = ${fmt(maxInstallmentBudget)}/mes):`);
    for (const o of viableOptions) {
      lines.push(`  ✅ ${o.months} cuotas → ${fmt(o.monthlyPayment)}/mes (${fmtPct(o.percentOfIncome)} de tus ingresos)`);
    }
    for (const o of blockedOptions) {
      lines.push(`  ❌ ${o.months} cuotas → ${fmt(o.monthlyPayment)}/mes (${fmtPct(o.percentOfIncome)} — supera el límite)`);
    }
  } else {
    lines.push(`\n_Configura tu ingreso mensual en Configuración para ver opciones de cuotas._`);
  }

  // Cutting suggestions
  if (cuttingSuggestions.length > 0) {
    lines.push(`\n**Para ahorrarlo recortando gastos:**`);
    for (const s of cuttingSuggestions) {
      lines.push(`  ✂️ Reducir **${s.category}** 20% → ahorras ${fmt(s.savingPer20pct)}/mes → lo tienes en **${s.monthsToSave} ${s.monthsToSave === 1 ? "mes" : "meses"}**`);
    }
  }

  // Verdict
  lines.push(`\n**Veredicto:**`);
  switch (verdict) {
    case "yes_direct_low":
      lines.push("✅ Puedes comprarlo sin problema. Impacto bajo en tus finanzas.");
      break;
    case "yes_direct_medium":
      lines.push("⚡ Puedes comprarlo, pero usará una parte significativa de tu saldo. Asegúrate de no quedarte sin reserva.");
      break;
    case "yes_direct_high":
      lines.push("⚠️ Técnicamente puedes pagarlo, pero comprometerías gran parte de tu saldo. Considera las cuotas o esperar.");
      break;
    case "yes_installments":
      lines.push(`✅ La mejor opción es ${bestInstallment!.months} cuotas de ${fmt(bestInstallment!.monthlyPayment)}/mes (${fmtPct(bestInstallment!.percentOfIncome)} de tus ingresos).`);
      break;
    case "save_then_buy":
      lines.push(`💡 No entra en cuotas dentro de tu límite ahora. La forma más rápida: recortar ${cuttingSuggestions[0].category} → listo en ${cuttingSuggestions[0].monthsToSave} ${cuttingSuggestions[0].monthsToSave === 1 ? "mes" : "meses"}.`);
      break;
    case "too_expensive":
      lines.push("❌ Esta compra no es viable con tu situación actual. Necesitarías aumentar ingresos o ahorrar por más de un año.");
      break;
  }

  return {
    amount,
    available,
    monthlyIncome,
    canAffordDirect,
    directImpact,
    installmentOptions,
    bestInstallment,
    cuttingSuggestions,
    verdict,
    formattedReply: lines.join("\n"),
  };
}
