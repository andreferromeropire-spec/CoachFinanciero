"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts";
import { fetcher } from "../lib/api";
import { formatCurrency, formatDate } from "../lib/format";
import { StatCard } from "./components/StatCard";
import { BudgetBar } from "./components/BudgetBar";
import { OnboardingWizard } from "./components/onboarding/OnboardingWizard";

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface Summary {
  totalIncome: number; totalExpenses: number; balance: number;
  byCategory: Record<string, number>;
  topMerchants: { merchant: string; total: number }[];
  dailyAverage: number;
}
interface Tx {
  id: string; amount: string; currency: string;
  description?: string; merchant?: string; category?: string; date: string; source: string;
}
interface BudgetStatus {
  id: string; name: string; spent: number; allocated: number; percent: number;
  status: "ok" | "warning" | "over";
}

/* ── Chart palette (vibrant, light-mode friendly) ───────────────────────────── */

const CHART_COLORS = [
  "#14B8A6", "#0EA5E9", "#8B5CF6", "#F59E0B",
  "#EF4444", "#EC4899", "#10B981", "#F97316",
];

const CATEGORY_ICON: Record<string, string> = {
  Supermercado: "🛒", Combustible: "⛽", Restaurantes: "🍽", Suscripciones: "📱",
  Salud: "❤️", Transporte: "🚌", Servicios: "⚡", Compras: "🛍",
  Entretenimiento: "🎬", Transferencias: "↔️", Finanzas: "🏦", Viajes: "✈️",
  Educación: "📚",
};

/* ── KPI icons (larger, colorful) ──────────────────────────────────────────── */

const IncomeIcon = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
  </svg>
);
const ExpenseIcon = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
  </svg>
);
const BalanceIcon = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
  </svg>
);

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}
function currentMonthLabel() {
  return new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

/* ── Source chip map ────────────────────────────────────────────────────────── */

const SOURCE_CHIP: Record<string, { label: string; style: string }> = {
  EMAIL:  { label: "Email",   style: "bg-sky/10 text-sky border-sky/20"          },
  API:    { label: "Webhook", style: "bg-purple/10 text-purple border-purple/20"  },
  CSV:    { label: "CSV",     style: "bg-orange-50 text-orange-500 border-orange-200" },
  MANUAL: { label: "Manual",  style: "bg-raised text-mid border-border"           },
};

/* ── Page ───────────────────────────────────────────────────────────────────── */

interface SharedPending {
  data: { id: string; description?: string; amount: string; yourShare?: string; sharedWith?: number; sharedStatus: string }[];
  totalPending: number;
}

interface Settings { onboardingCompleted: boolean }

export default function DashboardPage() {
  const { data: summary, isLoading: loadingSum } = useSWR<Summary>("/api/budget/summary", fetcher);
  const { data: txData }     = useSWR<{ data: Tx[] }>("/api/transactions?page=1", fetcher);
  const { data: budgetStatus } = useSWR<BudgetStatus[]>("/api/budget/categories/status", fetcher);
  const { data: sharedPending } = useSWR<SharedPending>("/api/transactions/shared/pending", fetcher);
  const { data: settings, mutate: mutateSettings } = useSWR<Settings>("/api/settings", fetcher);

  const [showWizard, setShowWizard] = useState(false);

  // Show wizard automatically on first load when onboarding not completed
  useEffect(() => {
    if (settings && !settings.onboardingCompleted) {
      setShowWizard(true);
    }
  }, [settings]);

  const transactions = txData?.data?.slice(0, 10) ?? [];

  const chartData = summary
    ? Object.entries(summary.byCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, value]) => ({ name, value: Math.round(value) }))
    : [];

  const totalChartValue = chartData.reduce((s, d) => s + d.value, 0);
  const balance = summary?.balance ?? 0;

  return (
    <div className="px-4 py-6 md:p-8 max-w-[1200px] mx-auto">

      {/* ── Onboarding wizard ───────────────────────────────────────────────── */}
      {showWizard && (
        <OnboardingWizard
          onClose={() => {
            setShowWizard(false);
            mutateSettings();
          }}
        />
      )}

      {/* ── Onboarding banner (dismissed but not completed) ─────────────────── */}
      {settings && !settings.onboardingCompleted && !showWizard && (
        <div className="mb-5 card px-5 py-4 flex items-center justify-between gap-4 border-l-4 border-l-teal bg-teal/3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚀</span>
            <div>
              <p className="font-bold text-hi text-sm">Configurá tu cuenta en 5 minutos</p>
              <p className="text-xs text-mid mt-0.5">Conectá Gmail, importá historial bancario y activá tus webhooks.</p>
            </div>
          </div>
          <button
            onClick={() => setShowWizard(true)}
            className="text-xs font-semibold text-teal border border-teal/30 bg-teal/8 hover:bg-teal/15 px-3 py-1.5 rounded-xl transition-colors shrink-0"
          >
            Configurar →
          </button>
        </div>
      )}

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <header className="mb-6 md:mb-8 flex items-center justify-between gap-3">
        <div>
          <p className="text-lo text-xs md:text-sm font-medium mb-0.5">{greeting()} 👋</p>
          <h1 className="text-2xl md:text-[2.2rem] font-bold text-hi tracking-tight leading-none">Dashboard</h1>
          <p className="text-mid text-xs md:text-sm mt-1 capitalize font-medium">{currentMonthLabel()}</p>
        </div>
        <Link
          href="/coach"
          className="flex items-center gap-2 bg-gradient-to-r from-teal to-teal-hover
                     text-white text-xs md:text-sm font-semibold px-3 md:px-5 py-2.5 md:py-3
                     rounded-xl md:rounded-2xl shadow-md shrink-0
                     hover:shadow-glow-teal hover:-translate-y-1 transition-all duration-250"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="hidden sm:inline">Hablar con el </span>Coach
        </Link>
      </header>

      {/* ── Shared expenses alert ────────────────────────────────────────────── */}
      {sharedPending && sharedPending.totalPending > 0 && (
        <div className="mb-6 card px-5 py-4 flex items-center justify-between gap-4 border-l-4 border-l-warning bg-warning/5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👥</span>
            <div>
              <p className="font-bold text-hi text-sm">Gastos compartidos pendientes</p>
              <p className="text-xs text-mid mt-0.5">
                {sharedPending.data.length} gasto{sharedPending.data.length !== 1 ? "s" : ""} · por cobrar{" "}
                <span className="font-semibold text-warning">{formatCurrency(sharedPending.totalPending)}</span>
              </p>
            </div>
          </div>
          <Link
            href="/transactions?filter=shared"
            className="text-xs font-semibold text-warning border border-warning/30 bg-warning/8 hover:bg-warning/15
                       px-3 py-1.5 rounded-xl transition-colors shrink-0"
          >
            Ver detalle →
          </Link>
        </div>
      )}

      {/* ── KPI Cards ───────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-3 gap-3 md:gap-5 mb-5 md:mb-6">
        {loadingSum ? (
          <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
        ) : (
          <>
            <StatCard
              title="Ingresos del mes"
              value={formatCurrency(summary?.totalIncome ?? 0)}
              sub={`Promedio diario: ${formatCurrency((summary?.totalIncome ?? 0) / 30)}`}
              positive
              icon={IncomeIcon}
              iconBg="bg-success/10"
            />
            <StatCard
              title="Gastos del mes"
              value={formatCurrency(summary?.totalExpenses ?? 0)}
              sub={`Promedio diario: ${formatCurrency(summary?.dailyAverage ?? 0)}`}
              negative
              icon={ExpenseIcon}
              iconBg="bg-danger/10"
            />
            <StatCard
              title="Balance disponible"
              value={formatCurrency(balance)}
              sub={balance >= 0 ? "En positivo ✓" : "Revisa tus gastos"}
              positive={balance >= 0}
              negative={balance < 0}
              icon={BalanceIcon}
              iconBg="bg-teal/10"
            />
          </>
        )}
      </section>

      {/* ── Charts row ──────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-5 mb-5">

        {/* Donut chart */}
        <div className="card card-hover p-7">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-hi text-base">Gastos por categoría</h2>
            {chartData.length > 0 && (
              <span className="text-xs text-mid bg-raised px-2.5 py-1 rounded-lg border border-border font-medium">
                Este mes
              </span>
            )}
          </div>

          {chartData.length > 0 ? (
            <div className="flex items-center gap-6">
              {/* Donut */}
              <div className="shrink-0">
                <ResponsiveContainer width={190} height={190}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%" cy="50%"
                      innerRadius={65} outerRadius={88}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => [formatCurrency(Number(v)), ""]}
                      contentStyle={{
                        background: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        borderRadius: 12,
                        fontSize: 12,
                        boxShadow: "0 4px 12px -2px rgb(0 0 0 / 0.08)",
                      }}
                      itemStyle={{ color: "#1E2937" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="flex-1 flex flex-col gap-2.5 min-w-0">
                {chartData.map((d, i) => {
                  const pct = totalChartValue > 0 ? ((d.value / totalChartValue) * 100).toFixed(0) : "0";
                  return (
                    <div key={i} className="flex items-center gap-2.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span className="text-mid text-xs truncate flex-1">{d.name}</span>
                      <span className="text-hi text-xs font-bold font-mono">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <PremiumEmptyState
              icon={
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" />
                </svg>
              }
              title="Aún no hay gastos categorizados"
              subtitle="Importa un CSV o reenvía un correo de tu banco"
              action={{ label: "Importar CSV →", href: "/transactions" }}
            />
          )}
        </div>

        {/* Budget bars */}
        <div className="card card-hover p-7">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-hi text-base">Estado del presupuesto</h2>
            {budgetStatus && budgetStatus.length > 0 && (
              <Link href="/settings" className="text-xs text-mid hover:text-teal transition-colors font-medium">
                Editar →
              </Link>
            )}
          </div>

          {budgetStatus && budgetStatus.length > 0 ? (
            <div className="flex flex-col divide-y divide-border/60">
              {budgetStatus.map((cat) => (
                <div key={cat.id} className="py-3 first:pt-0 last:pb-0">
                  <BudgetBar {...cat} />
                </div>
              ))}
            </div>
          ) : (
            <PremiumEmptyState
              icon={
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              }
              title="No hay presupuesto configurado"
              subtitle="Define cuánto quieres gastar por categoría"
              action={{ label: "Configurar presupuesto →", href: "/settings" }}
            />
          )}
        </div>
      </section>

      {/* ── Transactions table ───────────────────────────────────────────────── */}
      <section className="card overflow-hidden">
        {/* Table header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-border">
          <div>
            <h2 className="font-bold text-hi text-base">Últimas transacciones</h2>
            {transactions.length > 0 && (
              <p className="text-lo text-xs mt-0.5">Mostrando las {transactions.length} más recientes</p>
            )}
          </div>
          <Link
            href="/transactions"
            className="text-xs text-teal hover:text-teal-hover font-semibold flex items-center gap-1.5 transition-colors
                       bg-teal/8 hover:bg-teal/12 px-3 py-1.5 rounded-lg border border-teal/15"
          >
            Ver todas
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {transactions.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/60 bg-raised/40">
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-lo uppercase tracking-wider">Fecha</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-lo uppercase tracking-wider">Comercio / descripción</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-lo uppercase tracking-wider">Categoría</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-lo uppercase tracking-wider">Fuente</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold text-lo uppercase tracking-wider">Monto</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const amount   = parseFloat(tx.amount);
                const isPos    = amount >= 0;
                const cat      = tx.category ?? "Sin categorizar";
                const catIcon  = CATEGORY_ICON[cat] ?? "•";
                const sourceInfo = SOURCE_CHIP[tx.source] ?? SOURCE_CHIP.MANUAL;
                return (
                  <tr
                    key={tx.id}
                    className="border-b border-border/60 hover:bg-raised/70 transition-colors duration-150"
                  >
                    <td className="px-5 py-3.5 text-mid text-xs whitespace-nowrap font-medium">{formatDate(tx.date)}</td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-raised border border-border flex items-center justify-center text-base shrink-0">
                          {catIcon}
                        </div>
                        <span className="text-hi text-sm font-semibold">
                          {tx.merchant || tx.description || "—"}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className={cat === "Sin categorizar" ? "badge badge-muted" : "badge badge-teal"}>
                        {cat}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${sourceInfo.style}`}>
                        {sourceInfo.label}
                      </span>
                    </td>

                    <td className={`px-5 py-3.5 text-right font-bold text-sm font-mono tracking-tight ${isPos ? "text-success" : "text-danger"}`}>
                      {isPos ? "+" : ""}{formatCurrency(amount, tx.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="px-7 py-14">
            <PremiumEmptyState
              icon={
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              }
              title="Aún no hay transacciones"
              subtitle="Importa tu primer estado de cuenta o reenvía un correo de alerta de tu banco"
              action={{ label: "Importar ahora →", href: "/transactions" }}
            />
          </div>
        )}
      </section>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────────── */

function SkeletonCard() {
  return (
    <div className="card p-7 animate-pulse">
      <div className="w-12 h-12 rounded-2xl bg-raised mb-4" />
      <div className="h-2.5 bg-raised rounded w-1/3 mb-4" />
      <div className="h-10 bg-raised rounded w-3/4 mb-3" />
      <div className="h-2 bg-raised rounded w-1/2" />
    </div>
  );
}

interface PremiumEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action?: { label: string; href: string };
}

function PremiumEmptyState({ icon, title, subtitle, action }: PremiumEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center gap-3">
      <div className="w-16 h-16 rounded-2xl bg-raised border border-border/80 flex items-center justify-center mb-1 shadow-sm">
        {icon}
      </div>
      <p className="text-hi text-sm font-semibold">{title}</p>
      <p className="text-lo text-xs max-w-[200px] leading-relaxed">{subtitle}</p>
      {action && (
        <Link
          href={action.href}
          className="mt-1 text-xs font-semibold text-teal hover:text-teal-hover bg-teal/10 hover:bg-teal/15
                     border border-teal/25 px-4 py-2 rounded-xl transition-all duration-200"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
