"use client";

import { useState } from "react";
import { formatCurrency, formatDate } from "../../lib/format";
import { fetchWithAuthRetry } from "../../lib/api";

interface Tx {
  id: string;
  amount: string | number;
  currency: string;
  description?: string | null;
  merchant?: string | null;
  merchantNormalized?: string | null;
  category?: string | null;
  date: string;
  source: string;
  account?: { name: string; provider: string };
  isShared?: boolean;
  sharedWith?: number | null;
  sharedStatus?: "PENDING" | "PARTIALLY_PAID" | "SETTLED" | null;
  yourShare?: string | number | null;
  isInternalTransfer?: boolean;
  isIgnored?: boolean;
}

interface TransactionRowProps {
  tx: Tx;
  onCategoryChange?: (id: string, category: string) => void;
  onSharedUpdate?: () => void;
  onFlagChange?: () => void;
}

const CATEGORIES = [
  "Sin categorizar", "Supermercado", "Combustible", "Restaurantes",
  "Suscripciones", "Salud", "Transporte", "Servicios", "Compras",
  "Entretenimiento", "Transferencias", "Finanzas", "Viajes", "Educación",
  "Comida y delivery", "Hogar y limpieza", "Compras online",
];

const CATEGORY_ICON: Record<string, string> = {
  Supermercado: "🛒", Combustible: "⛽", Restaurantes: "🍽", Suscripciones: "📱",
  Salud: "❤️", Transporte: "🚌", Servicios: "⚡", Compras: "🛍",
  Entretenimiento: "🎬", Transferencias: "↔️", Finanzas: "🏦", Viajes: "✈️",
  Educación: "📚", "Comida y delivery": "🍕", "Hogar y limpieza": "🧹",
  "Compras online": "📦", Electrónica: "💻",
};

const SOURCE_CHIP: Record<string, { label: string; style: string }> = {
  EMAIL:  { label: "Email",   style: "bg-sky/10 text-sky border-sky/20"              },
  API:    { label: "Webhook", style: "bg-purple/10 text-purple border-purple/20"     },
  CSV:    { label: "CSV",     style: "bg-orange-50 text-orange-500 border-orange-200" },
  MANUAL: { label: "Manual",  style: "bg-raised text-mid border-border"              },
};

const SHARED_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  PARTIALLY_PAID: "Parcialmente cobrado",
  SETTLED: "Cobrado",
};

function SharedPopover({
  tx,
  onClose,
  onUpdate,
}: {
  tx: Tx;
  onClose: () => void;
  onUpdate?: () => void;
}) {
  const [settleAmount, setSettleAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const fullAmount = Math.abs(typeof tx.amount === "string" ? parseFloat(tx.amount) : tx.amount);
  const yourShare = tx.yourShare
    ? Math.abs(typeof tx.yourShare === "string" ? parseFloat(tx.yourShare) : tx.yourShare)
    : fullAmount;
  const pending = fullAmount - yourShare;
  const fmt = (n: number) => formatCurrency(n, tx.currency ?? "ARS");

  async function handleMarkShared(sharedWith: number) {
    setLoading(true);
    try {
      await fetchWithAuthRetry(`/api/transactions/${tx.id}/shared`, {
        method: "PATCH",
        body: JSON.stringify({ isShared: true, sharedWith }),
      });
      onUpdate?.();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  async function handleSettle() {
    const amt = parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0) return;
    setLoading(true);
    try {
      await fetchWithAuthRetry(`/api/transactions/${tx.id}/shared/settle`, {
        method: "POST",
        body: JSON.stringify({ amountReceived: amt }),
      });
      setSuccess(true);
      onUpdate?.();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-white rounded-2xl shadow-card-xl border border-border p-4" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-hi">Gasto compartido</span>
        <button onClick={onClose} className="text-lo hover:text-mid text-base leading-none">✕</button>
      </div>

      {!tx.isShared ? (
        <div>
          <p className="text-xs text-mid mb-2">¿Entre cuántas personas fue este gasto?</p>
          <div className="flex gap-2 flex-wrap">
            {[2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => handleMarkShared(n)}
                disabled={loading}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-teal/25 text-teal hover:bg-teal/10 transition-colors"
              >
                {n} personas
              </button>
            ))}
          </div>
        </div>
      ) : success ? (
        <p className="text-xs text-success font-medium">✅ Actualizado correctamente</p>
      ) : (
        <div>
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div>
              <p className="text-lo">Personas</p>
              <p className="font-bold text-hi">{tx.sharedWith}</p>
            </div>
            <div>
              <p className="text-lo">Tu parte</p>
              <p className="font-bold text-teal">{fmt(yourShare)}</p>
            </div>
            <div>
              <p className="text-lo">Por cobrar</p>
              <p className={`font-bold ${pending > 0 ? "text-warning" : "text-success"}`}>{fmt(pending)}</p>
            </div>
            <div>
              <p className="text-lo">Estado</p>
              <p className="font-semibold text-hi">{SHARED_STATUS_LABEL[tx.sharedStatus ?? "PENDING"]}</p>
            </div>
          </div>

          {tx.sharedStatus !== "SETTLED" && (
            <>
              <p className="text-xs text-mid mb-1.5">Monto recibido:</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  placeholder={`${Math.round(pending)}`}
                  className="input-light flex-1 text-xs py-1.5"
                />
                <button
                  onClick={handleSettle}
                  disabled={loading || !settleAmount}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-teal text-white hover:bg-teal-hover transition-colors disabled:opacity-50"
                >
                  Marcar cobrado
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function TransactionRow({ tx, onCategoryChange, onSharedUpdate, onFlagChange }: TransactionRowProps) {
  const [showSharedPopover, setShowSharedPopover] = useState(false);
  const [flagLoading, setFlagLoading] = useState(false);

  async function toggleFlag(field: "isInternalTransfer" | "isIgnored", current: boolean) {
    setFlagLoading(true);
    try {
      await fetchWithAuthRetry(`/api/transactions/${tx.id}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: !current }),
      });
      onFlagChange?.();
    } finally {
      setFlagLoading(false);
    }
  }

  const amount = typeof tx.amount === "string" ? parseFloat(tx.amount) : tx.amount;
  const isPositive = amount >= 0;
  const cat = tx.category ?? "Sin categorizar";
  const catIcon = CATEGORY_ICON[cat] ?? "•";
  const source = SOURCE_CHIP[tx.source] ?? SOURCE_CHIP.MANUAL;
  const displayName = tx.merchantNormalized ?? tx.merchant ?? tx.description ?? "—";

  const yourShare = tx.yourShare
    ? Math.abs(typeof tx.yourShare === "string" ? parseFloat(tx.yourShare) : tx.yourShare)
    : null;

  const rowOpacity = tx.isIgnored ? "opacity-40" : "";

  return (
    <tr className={`group border-b border-border/60 hover:bg-raised/70 transition-colors duration-150 ${rowOpacity}`}>
      {/* Date */}
      <td className="px-3 md:px-5 py-3 md:py-3.5 text-mid text-xs whitespace-nowrap font-medium">{formatDate(tx.date)}</td>

      {/* Merchant / description */}
      <td className="px-3 md:px-4 py-3 md:py-3.5">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden sm:flex w-9 h-9 rounded-xl bg-raised border border-border items-center justify-center text-base shrink-0">
            {catIcon}
          </div>
          <div className="min-w-0">
            <p className="text-hi text-xs md:text-sm font-semibold leading-tight truncate max-w-[140px] md:max-w-[220px]">{displayName}</p>
            {tx.merchantNormalized && tx.description && tx.merchantNormalized !== tx.description && (
              <p className="hidden sm:block text-lo text-xs mt-0.5 truncate max-w-[200px]">{tx.description}</p>
            )}
          </div>
        </div>
      </td>

      {/* Category — hidden on mobile */}
      <td className="hidden sm:table-cell px-4 py-3.5">
        {onCategoryChange ? (
          <select
            value={cat}
            onChange={(e) => onCategoryChange(tx.id, e.target.value)}
            className="select-light"
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : (
          <span className={cat === "Sin categorizar" ? "badge badge-muted" : "badge badge-teal"}>
            {cat}
          </span>
        )}
      </td>

      {/* Source + shared chip — hidden on mobile */}
      <td className="hidden sm:table-cell px-4 py-3.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${source.style}`}>
            {source.label}
          </span>
          {/* Internal transfer chip */}
          <button
            onClick={() => toggleFlag("isInternalTransfer", !!tx.isInternalTransfer)}
            disabled={flagLoading}
            title="Transferencia interna (no cuenta en gastos)"
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border transition-colors ${
              tx.isInternalTransfer
                ? "bg-purple/10 text-purple border-purple/20"
                : "bg-raised text-lo border-border hover:border-purple/30 hover:text-purple"
            }`}
          >
            ↔
          </button>
          {/* Ignored chip */}
          <button
            onClick={() => toggleFlag("isIgnored", !!tx.isIgnored)}
            disabled={flagLoading}
            title="Ignorar (no cuenta en ningún cálculo)"
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border transition-colors ${
              tx.isIgnored
                ? "bg-danger/10 text-danger border-danger/20"
                : "bg-raised text-lo border-border hover:border-danger/30 hover:text-danger"
            }`}
          >
            ✕
          </button>
          {/* Shared chip */}
          <div className="relative">
            <button
              onClick={() => setShowSharedPopover((v) => !v)}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border transition-colors ${
                tx.isShared
                  ? tx.sharedStatus === "SETTLED"
                    ? "bg-success/10 text-success border-success/20"
                    : "bg-warning/10 text-warning border-warning/25 animate-pulse"
                  : "bg-raised text-lo border-border hover:border-teal/30 hover:text-teal"
              }`}
              title={tx.isShared ? `Entre ${tx.sharedWith} — ${SHARED_STATUS_LABEL[tx.sharedStatus ?? "PENDING"]}` : "Marcar como compartido"}
            >
              {tx.isShared
                ? `👥 ${tx.sharedWith}p${tx.sharedStatus !== "SETTLED" && yourShare ? ` · ${formatCurrency(yourShare, tx.currency ?? "ARS")}` : ""}`
                : "👥"}
            </button>
            {showSharedPopover && (
              <SharedPopover
                tx={tx}
                onClose={() => setShowSharedPopover(false)}
                onUpdate={onSharedUpdate}
              />
            )}
          </div>
        </div>
      </td>

      {/* Amount — always visible */}
      <td className={`px-3 md:px-5 py-3 md:py-3.5 text-right font-bold text-xs md:text-sm font-mono tracking-tight whitespace-nowrap ${isPositive ? "text-success" : "text-danger"}`}>
        {isPositive ? "+" : ""}{formatCurrency(amount, tx.currency)}
        {tx.isShared && tx.sharedStatus !== "SETTLED" && yourShare && (
          <div className="hidden sm:block text-[10px] font-normal text-teal leading-tight">
            tu parte: {formatCurrency(yourShare, tx.currency ?? "ARS")}
          </div>
        )}
      </td>
    </tr>
  );
}
