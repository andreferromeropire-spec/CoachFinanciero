import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@coach/db";
import { budgetEngine, fullAffordabilityAnalysis } from "./BudgetEngine";
import { RULES } from "./financialRules";

// ── Special prefix for explicit Sonnet opt-in ─────────────────────────────────
// Frontend sends "__SONNET__: <original message>" when user clicks "Razonar con IA"
const SONNET_PREFIX = "__SONNET__:";

// ── Intent classification ─────────────────────────────────────────────────────

export type Intent =
  | "SIMPLE_AFFORDABILITY"
  | "INSTALLMENT_QUERY"
  | "SAVINGS_GOAL"
  | "SAVINGS_TIPS"
  | "MONTHLY_SUMMARY"
  | "BUDGET_SETUP"
  | "PRIORITY_CHECK"
  | "GENERAL_ANALYSIS";

const INTENT_RULES: { intent: Intent; patterns: RegExp[] }[] = [
  {
    intent: "SIMPLE_AFFORDABILITY",
    patterns: [
      /puedo comprar/i, /me alcanza/i, /tengo para/i, /puedo pagar/i,
      /me llega/i, /alcanza el dinero/i, /puedo gastar/i, /puedo permitirme/i,
    ],
  },
  {
    intent: "INSTALLMENT_QUERY",
    patterns: [
      /en cuotas/i, /financiad[ao]/i, /\d+\s*cuotas/i,
      /pagar en \d/i, /financiaci[oó]n/i, /cr[eé]dito/i,
    ],
  },
  {
    intent: "SAVINGS_GOAL",
    patterns: [
      /ahorrar para/i, /cu[aá]nto tiempo/i, /cu[aá]ndo puedo/i,
      /meta de ahorro/i, /juntar\s+\$?[\d.]+/i, /llegar a\s+\$?[\d.]+/i,
      /ahorrar\s+\$?[\d.]+/i, /para el viaje/i, /para comprarme/i,
    ],
  },
  {
    intent: "SAVINGS_TIPS",
    patterns: [
      /c[oó]mo ahorrar m[aá]s/i, /ahorrar dinero/i, /reducir gastos/i,
      /bajar gastos/i, /en qu[eé] gasto m[aá]s/i, /d[oó]nde puedo recortar/i,
      /optimizar gastos/i, /gastar menos/i, /ahorrar m[aá]s/i,
    ],
  },
  {
    intent: "MONTHLY_SUMMARY",
    patterns: [
      /c[oó]mo voy este mes/i, /c[oó]mo estoy este mes/i,
      /resumen del mes/i, /resumen financiero/i,
      /estado de mis finanzas/i, /cu[aá]nto gast[eé]/i,
      /cu[aá]nto gan[eé]/i, /mis finanzas este mes/i,
      /c[oó]mo van mis finanzas/i, /informe del mes/i,
    ],
  },
  {
    intent: "BUDGET_SETUP",
    patterns: [
      /armar\s+(?:\w+\s+)?presupuesto/i, /configurar\s+(?:\w+\s+)?presupuesto/i,
      /crear\s+(?:\w+\s+)?presupuesto/i, /hacer\s+(?:\w+\s+)?presupuesto/i,
      /organizar mis finanzas/i, /por d[oó]nde empiezo/i, /c[oó]mo empiezo/i,
      /empezar desde cero/i, /presupuesto desde cero/i,
    ],
  },
  {
    intent: "PRIORITY_CHECK",
    patterns: [
      /vale la pena/i, /conviene/i, /necesito\s+(comprar|un|una)/i,
      /debo comprar/i, /me recomiendas/i, /es necesario/i,
      /prioridad/i, /lo necesito/i,
    ],
  },
];

export function classifyIntent(message: string): Intent {
  for (const { intent, patterns } of INTENT_RULES) {
    if (patterns.some((p) => p.test(message))) return intent;
  }
  return "GENERAL_ANALYSIS";
}

// ── Compressed context builder (for Haiku/Sonnet calls only) ─────────────────

export interface FinancialContext {
  summary: string;
  topCategories: string;
  installmentsInfo: string;
  settings: {
    monthlyIncomeAvg: number | null;
    savingsGoalPercent: number | null;
    maxInstallmentPercent: number | null;
    sonnetCallsRemaining: number;
  };
}

export async function buildCompressedContext(): Promise<FinancialContext> {
  const [summary, catStatus, settings] = await Promise.all([
    budgetEngine.getSummary("current_month"),
    budgetEngine.getCategoryBudgetStatus(),
    prisma.userSettings.findFirst(),
  ]);

  const sonnetCallsRemaining = settings
    ? Math.max(0, settings.sonnetCallsLimit - settings.sonnetCallsThisMonth)
    : 20;

  const summaryText =
    `Ingresos: $${summary.totalIncome.toFixed(0)} | Gastos: $${summary.totalExpenses.toFixed(0)} | Balance: $${summary.balance.toFixed(0)}. ` +
    `Gasto diario: $${summary.dailyAverage.toFixed(0)}.`;

  const topCats = catStatus.slice(0, 5);
  const catLines =
    topCats.length > 0
      ? topCats.map((c) => `${c.name}: $${c.spent.toFixed(0)}/$${c.allocated.toFixed(0)} (${c.percent.toFixed(0)}%) [${c.status}]`).join("; ")
      : Object.entries(summary.byCategory)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, amount]) => `${name}: $${amount.toFixed(0)}`)
          .join("; ");

  const incomeAvg = settings?.monthlyIncomeAvg ? Number(settings.monthlyIncomeAvg) : null;
  const maxPct = settings?.maxInstallmentPercent ?? RULES.maxInstallmentPercent;
  const installmentsText = incomeAvg
    ? `Ingreso: $${incomeAvg.toFixed(0)}/mes. Límite cuotas: ${maxPct}% = $${(incomeAvg * maxPct / 100).toFixed(0)}/mes.`
    : `Límite cuotas: ${maxPct}% del ingreso (ingreso no configurado).`;

  return {
    summary: summaryText,
    topCategories: catLines || "Sin datos.",
    installmentsInfo: installmentsText,
    settings: {
      monthlyIncomeAvg: incomeAvg,
      savingsGoalPercent: settings?.savingsGoalPercent ?? null,
      maxInstallmentPercent: maxPct,
      sonnetCallsRemaining: sonnetCallsRemaining,
    },
  };
}

// ── System prompts ────────────────────────────────────────────────────────────

function buildHaikuPrompt(ctx: FinancialContext): string {
  return `Eres un coach financiero. Español neutro con "tú" — NUNCA voseo. Máximo 2 párrafos concisos.
DATOS: ${ctx.summary} | CATEGORÍAS: ${ctx.topCategories} | ${ctx.installmentsInfo}
META AHORRO: ${ctx.settings.savingsGoalPercent ?? "no configurada"}%`;
}

function buildSonnetPrompt(ctx: FinancialContext): string {
  return `Eres un coach financiero personal experto. Español neutro con "tú" — NUNCA voseo.
El usuario ha pedido un análisis en profundidad. Sé exhaustivo, estructurado y preciso.
Usa los datos reales. Máximo 4 párrafos o usa bullets si ayuda a la claridad.

DATOS FINANCIEROS: ${ctx.summary}
CATEGORÍAS Y PRESUPUESTO: ${ctx.topCategories}
CUOTAS E INGRESOS: ${ctx.installmentsInfo}
META AHORRO: ${ctx.settings.savingsGoalPercent ?? "no configurada"}%

REGLAS FINANCIERAS ACTIVAS:
- Límite cuotas/deuda: ${RULES.maxInstallmentPercent}% del ingreso mensual
- Meta ahorro: ${RULES.savingsTargetPercent}% del ingreso
- Fondo emergencia: ${RULES.emergencyFundMonths} meses de gastos
- Categorías recortables: ${RULES.cuttableCategories.join(", ")}`;
}

// ── Anthropic client ──────────────────────────────────────────────────────────

let _anthropic: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_anthropic) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY not set");
    _anthropic = new Anthropic({ apiKey: key });
  }
  return _anthropic;
}

type HistoryMessage = { role: "user" | "assistant"; content: string };

async function callHaiku(system: string, history: HistoryMessage[], userMessage: string): Promise<string> {
  const client = getClient();
  const resp = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    system,
    messages: [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userMessage },
    ],
  });
  await incrementHaikuCount();
  return resp.content[0].type === "text" ? resp.content[0].text : "";
}

async function callSonnet(system: string, history: HistoryMessage[], userMessage: string): Promise<string> {
  const client = getClient();
  const resp = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 900,
    system,
    messages: [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userMessage },
    ],
  });
  await incrementSonnetCount();
  return resp.content[0].type === "text" ? resp.content[0].text : "";
}

async function incrementSonnetCount() {
  const s = await getOrCreateSettings();
  await prisma.userSettings.update({ where: { id: s.id }, data: { sonnetCallsThisMonth: { increment: 1 } } });
}
async function incrementHaikuCount() {
  const s = await getOrCreateSettings();
  await prisma.userSettings.update({ where: { id: s.id }, data: { haikusCallsThisMonth: { increment: 1 } } });
}
async function getOrCreateSettings() {
  let s = await prisma.userSettings.findFirst();
  if (!s) s = await prisma.userSettings.create({ data: {} });
  return s;
}

async function checkAndResetMonthlyCounters() {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const s = await getOrCreateSettings();
  if (s.sonnetResetMonth !== currentMonth) {
    await prisma.userSettings.update({
      where: { id: s.id },
      data: { sonnetCallsThisMonth: 0, haikusCallsThisMonth: 0, sonnetResetMonth: currentMonth },
    });
  }
}

// ── Rule-based handlers ───────────────────────────────────────────────────────

async function handleMonthlySummary(sonnetCallsRemaining: number): Promise<CoachResponse> {
  const summary = await budgetEngine.getSummary("current_month");
  const cats = await budgetEngine.getCategoryBudgetStatus();
  const now = new Date();
  const monthName = now.toLocaleDateString("es", { month: "long" });
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysPassed = now.getDate();
  const balance = summary.totalIncome - summary.totalExpenses;

  const topCats = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const catLines = topCats.length > 0
    ? topCats.map(([name, amt], i) => `${i + 1}. ${name}: $${Math.round(amt).toLocaleString("es")}`).join("\n")
    : "Sin categorías registradas aún.";

  const overBudget = cats.filter((c) => c.status === "over");
  const warningBudget = cats.filter((c) => c.status === "warning");
  let alertLine = "";
  if (overBudget.length > 0) alertLine = `\n⚠️ Categorías excedidas: ${overBudget.map((c) => c.name).join(", ")}.`;
  else if (warningBudget.length > 0) alertLine = `\n⚡ Cerca del límite: ${warningBudget.map((c) => c.name).join(", ")}.`;

  const projectedExpenses = summary.dailyAverage * daysInMonth;
  const projLine = summary.totalExpenses > 0
    ? `\nProyección al cierre: ~$${Math.round(projectedExpenses).toLocaleString("es")}`
    : "";

  const balanceLabel = balance >= 0 ? "positivo ✅" : "negativo ⚠️";

  const reply =
    `📊 **Resumen de ${monthName}** (día ${daysPassed}/${daysInMonth})\n\n` +
    `• Ingresos: $${Math.round(summary.totalIncome).toLocaleString("es")}\n` +
    `• Gastos: $${Math.round(summary.totalExpenses).toLocaleString("es")}\n` +
    `• Balance: $${Math.round(Math.abs(balance)).toLocaleString("es")} (${balanceLabel})\n` +
    `• Gasto diario: $${Math.round(summary.dailyAverage).toLocaleString("es")}\n\n` +
    `**Top categorías:**\n${catLines}` +
    alertLine + projLine;

  return {
    reply,
    modelUsed: "none",
    allowDeepAnalysis: true,
    budgetData: { type: "summary", totalIncome: summary.totalIncome, totalExpenses: summary.totalExpenses, balance },
    suggestedActions: balance < 0
      ? ["¿Cómo puedo reducir gastos?", "¿Cómo puedo ahorrar más?"]
      : ["¿Cuánto puedo ahorrar este mes?", "¿Cómo puedo ahorrar más?"],
    sonnetCallsRemaining: sonnetCallsRemaining,
  };
}

async function handleSavingsTips(sonnetCallsRemaining: number): Promise<CoachResponse> {
  const summary = await budgetEngine.getSummary("current_month");
  if (summary.totalExpenses === 0) {
    return {
      reply: "Aún no hay gastos registrados este mes. Importa un estado de cuenta para ver en qué puedes ahorrar.",
      modelUsed: "none",
      allowDeepAnalysis: false,
      suggestedActions: ["Importar CSV"],
      sonnetCallsRemaining: sonnetCallsRemaining,
    };
  }

  const topCats = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const catAnalysis = topCats.map(([name, amt]) => {
    const pct = ((amt / summary.totalExpenses) * 100).toFixed(0);
    const saving = Math.round(amt * 0.2);
    return `• **${name}**: $${Math.round(amt).toLocaleString("es")} (${pct}%) → reducir 20% = $${saving.toLocaleString("es")}/mes`;
  });

  const savings = summary.totalIncome - summary.totalExpenses;
  const currentPct = summary.totalIncome > 0 ? ((savings / summary.totalIncome) * 100).toFixed(0) : "0";

  const reply =
    `💡 **Oportunidades de ahorro este mes:**\n\n` +
    catAnalysis.join("\n") +
    `\n\n` +
    (savings > 0
      ? `Ahorras $${Math.round(savings).toLocaleString("es")}/mes (${currentPct}% de tus ingresos). `
      : `Este mes tus gastos superan tus ingresos. `) +
    `El mayor potencial está en la categoría más alta.`;

  return {
    reply,
    modelUsed: "none",
    allowDeepAnalysis: true,
    suggestedActions: ["¿Cómo voy este mes?", "Quiero ahorrar $100.000"],
    sonnetCallsRemaining: sonnetCallsRemaining,
  };
}

// ── PRIORITY_CHECK follow-up ──────────────────────────────────────────────────

const PRIORITY_QUESTIONS = [
  "¿Tu dispositivo o producto actual tiene algún problema funcional, o es más por gusto o mejora?",
  "¿Lo usarías todos los días o es algo más ocasional?",
];

function needsPriorityFollowUp(history: HistoryMessage[]): string | null {
  const assistantMessages = history.filter((m) => m.role === "assistant");
  const asked = assistantMessages.filter((m) =>
    PRIORITY_QUESTIONS.some((q) => m.content.includes(q.slice(0, 30)))
  ).length;
  return asked < PRIORITY_QUESTIONS.length ? PRIORITY_QUESTIONS[asked] : null;
}

// ── BudgetData / CoachResponse types ─────────────────────────────────────────

export interface BudgetData {
  type: "affordability" | "installments" | "savings" | "summary";
  amount?: number;
  currency?: string;
  canAfford?: boolean;
  availableBalance?: number;
  impact?: string;
  monthlyPayment?: number;
  months?: number;
  targetDate?: string;
  currentMonthlySaving?: number;
  totalIncome?: number;
  totalExpenses?: number;
  balance?: number;
}

export interface CoachResponse {
  reply: string;
  modelUsed: "none" | "haiku" | "sonnet" | "error";
  /** true → show "Razonar con IA?" button in the frontend */
  allowDeepAnalysis?: boolean;
  budgetData?: BudgetData;
  suggestedActions?: string[];
  sonnetCallsRemaining?: number;
}

// ── Main chat function ────────────────────────────────────────────────────────

export async function processMessage(
  rawMessage: string,
  history: HistoryMessage[]
): Promise<CoachResponse> {
  await checkAndResetMonthlyCounters();

  const settings = await getOrCreateSettings();
  const sonnetCallsRemaining = Math.max(0, settings.sonnetCallsLimit - settings.sonnetCallsThisMonth);

  // ── EXPLICIT SONNET OPT-IN ────────────────────────────────────────────────
  // Triggered when user clicks "Razonar con IA?" in the UI
  if (rawMessage.startsWith(SONNET_PREFIX)) {
    const realMessage = rawMessage.slice(SONNET_PREFIX.length).trim();
    if (sonnetCallsRemaining <= 0) {
      return {
        reply: `Has alcanzado el límite de ${settings.sonnetCallsLimit} consultas Sonnet este mes. Se renueva el próximo mes.`,
        modelUsed: "none",
        allowDeepAnalysis: false,
        sonnetCallsRemaining: 0,
      };
    }
    const ctx = await buildCompressedContext();
    const system = buildSonnetPrompt(ctx);
    const reply = await callSonnet(system, history, realMessage);
    console.log(`[coach] Sonnet (opt-in) ← "${realMessage.slice(0, 50)}" (${sonnetCallsRemaining - 1} restantes)`);
    return { reply, modelUsed: "sonnet", allowDeepAnalysis: false, sonnetCallsRemaining: sonnetCallsRemaining - 1 };
  }

  const message = rawMessage;
  const intent = classifyIntent(message);
  console.log(`[coach] Intent: ${intent} | "${message.slice(0, 60)}"`);

  // ── MONTHLY_SUMMARY — rule-based ─────────────────────────────────────────
  if (intent === "MONTHLY_SUMMARY") {
    console.log("[coach] Rule-based → MONTHLY_SUMMARY");
    return handleMonthlySummary(sonnetCallsRemaining);
  }

  // ── SAVINGS_TIPS — rule-based ────────────────────────────────────────────
  if (intent === "SAVINGS_TIPS") {
    console.log("[coach] Rule-based → SAVINGS_TIPS");
    return handleSavingsTips(sonnetCallsRemaining);
  }

  // ── SIMPLE_AFFORDABILITY — full analysis, zero AI ─────────────────────────
  if (intent === "SIMPLE_AFFORDABILITY") {
    const amountMatch = message.match(/\$?\s*([\d.,]+(?:\.?\d{3})*)/);
    if (amountMatch) {
      const rawNum = amountMatch[1].replace(/\./g, "").replace(",", ".");
      const amount = parseFloat(rawNum);
      if (!isNaN(amount) && amount > 0) {
        console.log("[coach] Rule-based → FULL AFFORDABILITY ANALYSIS");
        const result = await fullAffordabilityAnalysis(amount);
        return {
          reply: result.formattedReply,
          modelUsed: "none",
          allowDeepAnalysis: true,
          budgetData: {
            type: "affordability",
            amount,
            currency: "ARS",
            canAfford: result.canAffordDirect,
            availableBalance: result.available,
            impact: result.directImpact,
          },
          suggestedActions: result.canAffordDirect
            ? ["¿Cómo voy este mes?", "¿Cómo puedo ahorrar más?"]
            : result.bestInstallment
              ? [`¿Puedo pagarlo en ${result.bestInstallment.months} cuotas de $${Math.round(result.bestInstallment.monthlyPayment).toLocaleString("es")}?`, "¿Cómo puedo ahorrar para comprarlo?"]
              : ["¿Cómo puedo ahorrar para comprarlo?", "¿Cómo voy este mes?"],
          sonnetCallsRemaining: sonnetCallsRemaining,
        };
      }
    }
    return {
      reply: "¿De cuánto es la compra? Dime el monto y te hago el análisis completo (saldo, cuotas y qué podrías recortar).",
      modelUsed: "none",
      allowDeepAnalysis: false,
      suggestedActions: ["¿Puedo comprar $10.000?", "¿Puedo comprar $50.000?", "¿Puedo comprar $100.000?"],
      sonnetCallsRemaining: sonnetCallsRemaining,
    };
  }

  // ── INSTALLMENT_QUERY — BudgetEngine ─────────────────────────────────────
  if (intent === "INSTALLMENT_QUERY") {
    const amountMatch = message.match(/\$?\s*([\d.,]+(?:\.?\d{3})*)/);
    const cuotasMatch = message.match(/(\d+)\s*cuotas?/i);
    if (amountMatch && cuotasMatch) {
      const amount = parseFloat(amountMatch[1].replace(/\./g, "").replace(",", "."));
      const installments = parseInt(cuotasMatch[1], 10);
      if (!isNaN(amount) && !isNaN(installments) && installments > 0) {
        const result = await budgetEngine.canAffordInInstallments(amount, installments);
        console.log("[coach] BudgetEngine → INSTALLMENT_QUERY");
        return {
          reply: result.recommendation,
          modelUsed: "none",
          allowDeepAnalysis: true,
          budgetData: { type: "installments", amount, monthlyPayment: result.monthlyPayment, canAfford: result.withinLimit },
          suggestedActions: result.withinLimit
            ? ["¿Cómo voy este mes?", "¿Cómo puedo ahorrar más?"]
            : ["¿Cómo puedo ahorrar para comprarlo?", "¿Cómo voy este mes?"],
          sonnetCallsRemaining: sonnetCallsRemaining,
        };
      }
    }
    // Also try a full affordability analysis if there's an amount
    const amountFallback = message.match(/\$?\s*([\d.,]+(?:\.?\d{3})*)/);
    if (amountFallback) {
      const amount = parseFloat(amountFallback[1].replace(/\./g, "").replace(",", "."));
      if (!isNaN(amount) && amount > 0) {
        const result = await fullAffordabilityAnalysis(amount);
        return { reply: result.formattedReply, modelUsed: "none", allowDeepAnalysis: true, sonnetCallsRemaining: sonnetCallsRemaining };
      }
    }
    return {
      reply: "Para analizar las cuotas necesito el monto total y la cantidad de cuotas. Por ejemplo: \"$200.000 en 12 cuotas\".",
      modelUsed: "none",
      allowDeepAnalysis: false,
      suggestedActions: [],
      sonnetCallsRemaining: sonnetCallsRemaining,
    };
  }

  // ── SAVINGS_GOAL — BudgetEngine ───────────────────────────────────────────
  if (intent === "SAVINGS_GOAL") {
    const amountMatch = message.match(/\$?\s*([\d.,]+(?:\.?\d{3})*)/);
    if (amountMatch) {
      const amount = parseFloat(amountMatch[1].replace(/\./g, "").replace(",", "."));
      if (!isNaN(amount) && amount > 0) {
        const result = await budgetEngine.timeToSave(amount);
        console.log("[coach] BudgetEngine → SAVINGS_GOAL");
        const fmt = (n: number) => `$${Math.round(n).toLocaleString("es")}`;
        const monthsText = result.feasible
          ? `En **${result.months} meses** (aprox. ${result.targetDate.toLocaleDateString("es", { month: "long", year: "numeric" })})`
          : "Con el ahorro actual no es posible proyectar una fecha";
        const reply =
          `🎯 **Meta de ahorro: ${fmt(amount)}**\n\n` +
          `${monthsText}.\n` +
          `• Ahorro actual: ${fmt(result.currentMonthlySaving)}/mes\n` +
          `• Necesitas: ${fmt(result.requiredMonthlySaving)}/mes para llegar antes`;
        return {
          reply,
          modelUsed: "none",
          allowDeepAnalysis: true,
          budgetData: { type: "savings", amount, months: result.feasible ? result.months : undefined, targetDate: result.targetDate.toISOString(), currentMonthlySaving: result.currentMonthlySaving },
          suggestedActions: ["¿Cómo puedo ahorrar más?", "¿Cómo voy este mes?"],
          sonnetCallsRemaining: sonnetCallsRemaining,
        };
      }
    }
    return {
      reply: "¡Buena meta! ¿Cuánto necesitas juntar? Dime el monto y te calculo cuánto tiempo tardarías.",
      modelUsed: "none",
      allowDeepAnalysis: false,
      suggestedActions: ["Quiero ahorrar $50.000", "Quiero ahorrar $200.000", "Quiero ahorrar $1.000.000"],
      sonnetCallsRemaining: sonnetCallsRemaining,
    };
  }

  // ── BUDGET_SETUP — Haiku ──────────────────────────────────────────────────
  if (intent === "BUDGET_SETUP") {
    const ctx = await buildCompressedContext();
    const reply = await callHaiku(buildHaikuPrompt(ctx), history, message);
    console.log("[coach] Haiku → BUDGET_SETUP");
    return {
      reply,
      modelUsed: "haiku",
      allowDeepAnalysis: true,
          suggestedActions: ["¿Cómo voy este mes?", "¿Cómo puedo ahorrar más?"],
      sonnetCallsRemaining: sonnetCallsRemaining,
    };
  }

  // ── PRIORITY_CHECK — follow-up questions + Haiku ──────────────────────────
  if (intent === "PRIORITY_CHECK") {
    const nextQ = needsPriorityFollowUp(history);
    if (nextQ) {
      return {
        reply: nextQ,
        modelUsed: "none",
        allowDeepAnalysis: false,
        suggestedActions: ["Tiene un problema funcional", "Solo quiero actualizarlo", "Lo usaría diario"],
        sonnetCallsRemaining: sonnetCallsRemaining,
      };
    }
    const ctx = await buildCompressedContext();
    const reply = await callHaiku(buildHaikuPrompt(ctx), history, message);
    console.log("[coach] Haiku → PRIORITY_CHECK");
    return { reply, modelUsed: "haiku", allowDeepAnalysis: true, sonnetCallsRemaining: sonnetCallsRemaining };
  }

  // ── GENERAL_ANALYSIS — Haiku only (Sonnet is explicit opt-in) ────────────
  const ctx = await buildCompressedContext();
  const reply = await callHaiku(buildHaikuPrompt(ctx), history, message);
  console.log("[coach] Haiku → GENERAL_ANALYSIS");
  return { reply, modelUsed: "haiku", allowDeepAnalysis: true, sonnetCallsRemaining: sonnetCallsRemaining };
}
