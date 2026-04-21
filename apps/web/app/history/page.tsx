"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from "recharts";
import { fetcher } from "../../lib/api";
import { formatCurrency } from "../../lib/format";

const CHART_COLORS = ["#14B8A6","#0EA5E9","#8B5CF6","#F59E0B","#EF4444","#EC4899","#10B981","#F97316"];

const CHART_MARGIN = { top: 5, right: 10, left: -20, bottom: 5 };

function fmtAxis(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v}`;
}

const AXIS_STYLE = { fontSize: 10, fill: "#64748B" };

// ── Types ─────────────────────────────────────────────────────────────────────

interface MonthData {
  month: string; monthIndex: number; year: number;
  income: number; expenses: number; savings: number; savingsRate: number;
  byCategory: { name: string; amount: number }[];
  topMerchants: { name: string; amount: number; count: number }[];
  transactionCount: number;
}

interface YearData {
  year: number; income: number; expenses: number;
  savings: number; savingsRate: number; transactionCount: number;
}

interface TrendsData {
  bestMonth: { month: string; year: number; savings: number } | null;
  worstMonth: { month: string; year: number; expenses: number } | null;
  avgMonthlySavings: number; avgMonthlyExpenses: number;
  bestSavingsStreak: number;
  categoryTrends: { category: string; recentMonthlyAvg: number; change: number; trend: "up"|"down"|"stable" }[];
  monthlyData: { month: string; year: number; key: string; income: number; expenses: number; savings: number }[];
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-card-lg border border-border px-4 py-3 text-sm">
      <p className="font-bold text-hi mb-2">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

// ── Trend chip ────────────────────────────────────────────────────────────────

function TrendChip({ trend, change }: { trend: "up"|"down"|"stable"; change: number }) {
  if (trend === "up") return <span className="text-[11px] font-semibold text-danger bg-danger/10 border border-danger/20 px-2 py-0.5 rounded-full">↑ +{change.toFixed(0)}%</span>;
  if (trend === "down") return <span className="text-[11px] font-semibold text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full">↓ {change.toFixed(0)}%</span>;
  return <span className="text-[11px] font-semibold text-mid bg-raised border border-border px-2 py-0.5 rounded-full">→ estable</span>;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data: yearlyData } = useSWR<YearData[]>("/api/analytics/yearly", fetcher);
  const yearTabs =
    yearlyData && yearlyData.length > 0
      ? [...new Set(yearlyData.map((y) => y.year))].sort((a, b) => a - b)
      : [currentYear - 2, currentYear - 1, currentYear];

  const { data: monthlyData, isLoading: loadingMonthly } = useSWR<MonthData[]>(`/api/analytics/monthly?year=${selectedYear}`, fetcher);
  const { data: trends } = useSWR<TrendsData>("/api/analytics/trends", fetcher);

  useEffect(() => {
    if (!yearlyData?.length) return;
    const ys = [...new Set(yearlyData.map((y) => y.year))].sort((a, b) => a - b);
    if (!ys.includes(selectedYear)) setSelectedYear(ys[ys.length - 1]);
  }, [yearlyData, selectedYear]);

  const selectedYearData = yearlyData?.find((y) => y.year === selectedYear);

  // For stacked area chart: gather all categories
  const allCategories = Array.from(
    new Set(monthlyData?.flatMap((m) => m.byCategory.map((c) => c.name)) ?? [])
  ).slice(0, 6);

  const areaData = monthlyData?.map((m) => {
    const obj: Record<string, unknown> = { month: m.month.slice(0, 3) };
    for (const cat of allCategories) {
      obj[cat] = m.byCategory.find((c) => c.name === cat)?.amount ?? 0;
    }
    return obj;
  }) ?? [];

  // Month table: highlight over/under average
  const avgExpenses = monthlyData
    ? monthlyData.reduce((s, m) => s + m.expenses, 0) / Math.max(1, monthlyData.filter((m) => m.transactionCount > 0).length)
    : 0;

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto pb-24 md:pb-8">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-[2rem] font-bold text-hi tracking-tight">Historia financiera</h1>
        <p className="text-mid text-xs md:text-sm mt-1">Evolución de tus ingresos, gastos y ahorros en el tiempo</p>
      </header>

      {/* ── Year tabs (todos los años con datos, desde la API) ───────────────── */}
      <div className="mb-2">
        <p className="text-xs text-mid mb-2">
          Elegí el año: incluye todo el historial que tengas cargado (importaciones desde 2021, CSV, etc.).
        </p>
        <div className="flex flex-wrap gap-2 mb-6 max-h-36 overflow-y-auto pr-1">
          {yearTabs.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setSelectedYear(y)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border shrink-0 ${
                selectedYear === y
                  ? "bg-teal text-white border-teal shadow-sm"
                  : "bg-white text-mid border-border hover:border-teal/40 hover:text-teal"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* ── Annual summary cards ──────────────────────────────────────────────── */}
      {selectedYearData && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Ingresos totales", value: selectedYearData.income, color: "text-success", icon: "💰" },
            { label: "Gastos totales", value: selectedYearData.expenses, color: "text-danger", icon: "💸" },
            { label: "Ahorro total", value: selectedYearData.savings, color: selectedYearData.savings >= 0 ? "text-teal" : "text-danger", icon: "🏦" },
            { label: "Tasa de ahorro", value: null, pct: selectedYearData.savingsRate, color: "text-purple", icon: "📈" },
          ].map((c, i) => (
            <div key={i} className="card px-4 py-4">
              <div className="text-2xl mb-2">{c.icon}</div>
              <p className="text-xs text-mid font-medium">{c.label}</p>
              <p className={`text-xl font-bold mt-1 ${c.color}`}>
                {c.value !== null ? formatCurrency(c.value) : `${c.pct?.toFixed(1)}%`}
              </p>
            </div>
          ))}
        </section>
      )}

      {/* ── Smart insights (trends) ───────────────────────────────────────────── */}
      {trends && (
        <section className="card px-5 py-4 mb-8">
          <h2 className="font-bold text-hi text-base mb-4">Análisis inteligente</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-success/5 rounded-xl px-4 py-3 border border-success/15">
              <p className="text-xs text-mid font-medium mb-1">Mejor mes de ahorro</p>
              <p className="font-bold text-hi">
                {trends.bestMonth ? `${trends.bestMonth.month} ${trends.bestMonth.year}` : "Sin datos"}
              </p>
              {trends.bestMonth && (
                <p className="text-success text-xs font-semibold mt-0.5">{formatCurrency(trends.bestMonth.savings)} ahorrados</p>
              )}
            </div>
            <div className="bg-danger/5 rounded-xl px-4 py-3 border border-danger/15">
              <p className="text-xs text-mid font-medium mb-1">Mes de mayor gasto</p>
              <p className="font-bold text-hi">
                {trends.worstMonth ? `${trends.worstMonth.month} ${trends.worstMonth.year}` : "Sin datos"}
              </p>
              {trends.worstMonth && (
                <p className="text-danger text-xs font-semibold mt-0.5">{formatCurrency(trends.worstMonth.expenses)} gastados</p>
              )}
            </div>
            <div className="bg-purple/5 rounded-xl px-4 py-3 border border-purple/15">
              <p className="text-xs text-mid font-medium mb-1">Racha de ahorro</p>
              <p className="font-bold text-hi">{trends.bestSavingsStreak} meses consecutivos</p>
              <p className="text-mid text-xs mt-0.5">Promedio mensual: {formatCurrency(trends.avgMonthlySavings)}</p>
            </div>
          </div>
        </section>
      )}

      {/* ── Bar chart: income vs expenses by month ────────────────────────────── */}
      <section className="card px-5 py-5 mb-6">
        <h2 className="font-bold text-hi text-base mb-4">Ingresos vs Gastos por mes</h2>
        {loadingMonthly ? (
          <div className="h-56 bg-raised animate-pulse rounded-xl" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData?.map((m) => ({ month: m.month.slice(0, 3), Ingresos: m.income, Gastos: m.expenses })) ?? []} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={AXIS_STYLE} />
              <YAxis tick={AXIS_STYLE} tickFormatter={fmtAxis} width={45} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Ingresos" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Gastos" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* ── Line chart: savings evolution ────────────────────────────────────── */}
      <section className="card px-5 py-5 mb-6">
        <h2 className="font-bold text-hi text-base mb-4">Evolución del ahorro</h2>
        {loadingMonthly ? (
          <div className="h-48 bg-raised animate-pulse rounded-xl" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlyData?.map((m) => ({ month: m.month.slice(0, 3), Ahorro: m.savings })) ?? []} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={AXIS_STYLE} />
              <YAxis tick={AXIS_STYLE} tickFormatter={fmtAxis} width={45} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="Ahorro" stroke="#14B8A6" strokeWidth={2.5} dot={{ fill: "#14B8A6", r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* ── Stacked area: expenses by category ───────────────────────────────── */}
      {areaData.length > 0 && (
        <section className="card px-5 py-5 mb-6">
          <h2 className="font-bold text-hi text-base mb-4">Gastos por categoría en el tiempo</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={areaData} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={AXIS_STYLE} />
              <YAxis tick={AXIS_STYLE} tickFormatter={fmtAxis} width={45} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {allCategories.map((cat, i) => (
                <Area key={cat} type="monotone" dataKey={cat} stackId="1"
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                  fillOpacity={0.7}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* ── Monthly table ─────────────────────────────────────────────────────── */}
      <section className="card overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-bold text-hi text-base">Resumen mensual</h2>
          <p className="text-xs text-mid mt-0.5">Rojo = sobre el promedio anual · Verde = bajo el promedio</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-raised/40">
                <th className="px-5 py-3 text-left text-xs font-bold text-mid uppercase tracking-wider">Mes</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-mid uppercase tracking-wider">Ingresos</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-mid uppercase tracking-wider">Gastos</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-mid uppercase tracking-wider">Ahorro</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-mid uppercase tracking-wider hidden md:table-cell">Tasa</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-mid uppercase tracking-wider hidden md:table-cell">Transacciones</th>
              </tr>
            </thead>
            <tbody>
              {(monthlyData ?? Array.from({ length: 12 })).map((m, i) => {
                if (!m) return (
                  <tr key={i} className="border-b border-border/60">
                    <td colSpan={6} className="px-5 py-3">
                      <div className="h-4 bg-raised animate-pulse rounded" />
                    </td>
                  </tr>
                );
                const overAvg = m.expenses > avgExpenses * 1.1 && m.transactionCount > 0;
                const underAvg = m.expenses < avgExpenses * 0.9 && m.transactionCount > 0;
                return (
                  <tr key={i} className="border-b border-border/60 hover:bg-raised/50 transition-colors">
                    <td className="px-5 py-3 font-semibold text-hi">{m.month}</td>
                    <td className="px-4 py-3 text-right text-success font-mono font-semibold text-xs">
                      {m.income > 0 ? formatCurrency(m.income) : "—"}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold text-xs ${overAvg ? "text-danger" : underAvg ? "text-success" : "text-hi"}`}>
                      {m.expenses > 0 ? formatCurrency(m.expenses) : "—"}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-bold text-xs ${m.savings >= 0 ? "text-teal" : "text-danger"}`}>
                      {m.transactionCount > 0 ? formatCurrency(m.savings) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-mid text-xs hidden md:table-cell">
                      {m.transactionCount > 0 ? `${m.savingsRate.toFixed(0)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-mid text-xs hidden md:table-cell">{m.transactionCount || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Category trends ───────────────────────────────────────────────────── */}
      {trends?.categoryTrends && trends.categoryTrends.length > 0 && (
        <section className="card px-5 py-5 mb-8">
          <h2 className="font-bold text-hi text-base mb-1">Tendencias por categoría</h2>
          <p className="text-xs text-mid mb-4">Comparando últimos 3 meses vs los 3 anteriores</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {trends.categoryTrends.map((ct) => (
              <div key={ct.category} className="flex items-center justify-between px-4 py-3 bg-raised/60 rounded-xl border border-border">
                <div>
                  <p className="text-sm font-semibold text-hi">{ct.category}</p>
                  <p className="text-xs text-mid">{formatCurrency(ct.recentMonthlyAvg)}/mes (promedio reciente)</p>
                </div>
                <TrendChip trend={ct.trend} change={ct.change} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Yearly comparison ─────────────────────────────────────────────────── */}
      {yearlyData && (
        <section className="card px-5 py-5 mb-8">
          <h2 className="font-bold text-hi text-base mb-4">Comparativa anual</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={yearlyData} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="year" tick={AXIS_STYLE} />
              <YAxis tick={AXIS_STYLE} tickFormatter={fmtAxis} width={45} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income" name="Ingresos" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Gastos" fill="#EF4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="savings" name="Ahorro">
                {yearlyData.map((entry, index) => (
                  <Cell key={index} fill={entry.savings >= 0 ? "#14B8A6" : "#EF4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}
    </div>
  );
}
