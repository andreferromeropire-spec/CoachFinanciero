"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import useSWR from "swr";
import { fetcher } from "../../lib/api";
import { formatCurrency } from "../../lib/format";

const SONNET_PREFIX = "__SONNET__:";

interface BudgetData {
  type: "affordability" | "installments" | "savings" | "summary";
  amount?: number;
  currency?: string;
  canAfford?: boolean;
  availableBalance?: number;
  impact?: "low" | "medium" | "high";
  monthlyPayment?: number;
  months?: number;
  targetDate?: string;
  currentMonthlySaving?: number;
  totalIncome?: number;
  totalExpenses?: number;
  balance?: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  modelUsed?: "none" | "haiku" | "sonnet" | "error";
  allowDeepAnalysis?: boolean;
  /** The original user message that triggered this response (for re-sending to Sonnet) */
  originalUserMessage?: string;
  budgetData?: BudgetData;
  suggestedActions?: string[];
}

interface Settings {
  sonnetCallsThisMonth: number;
  sonnetCallsLimit: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const QUICK_ACTIONS = [
  "¿Puedo comprar algo de $50.000?",
  "¿Cómo voy este mes?",
  "Quiero ahorrar para un viaje de $200.000",
  "Crear mi presupuesto desde cero",
];

const MODEL_CHIP: Record<string, { label: string; color: string }> = {
  none:   { label: "reglas",   color: "bg-success/10 text-success border-success/20" },
  haiku:  { label: "haiku",   color: "bg-sky/10 text-sky border-sky/20"              },
  sonnet: { label: "sonnet ✨", color: "bg-purple/10 text-purple border-purple/20"  },
  error:  { label: "error",   color: "bg-danger/10 text-danger border-danger/20"     },
};

const IMPACT_COLOR = { low: "text-success", medium: "text-warning", high: "text-danger" };

/** Convierte **bold** e _italic_ inline, manteniendo saltos de línea */
function parseMarkdown(text: string) {
  const inlinePattern = /(\*\*[^*\n]+\*\*|_[^_\n]+_|\[([^\]]+)\]\((https?:\/\/[^)]+)\))/g;

  return text.split("\n").map((line, li, arr) => {
    const segments: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    inlinePattern.lastIndex = 0;
    while ((m = inlinePattern.exec(line)) !== null) {
      if (m.index > last) segments.push(line.slice(last, m.index));
      const tok = m[1];
      if (tok.startsWith("**")) {
        segments.push(<strong key={m.index}>{tok.slice(2, -2)}</strong>);
      } else if (tok.startsWith("_")) {
        segments.push(<em key={m.index}>{tok.slice(1, -1)}</em>);
      } else if (tok.startsWith("[")) {
        segments.push(<a key={m.index} href={m[3]} target="_blank" rel="noopener noreferrer" className="underline text-teal">{m[2]}</a>);
      }
      last = m.index + tok.length;
    }
    if (last < line.length) segments.push(line.slice(last));
    return (
      <span key={li}>
        {segments.length > 0 ? segments : line}
        {li < arr.length - 1 && <br />}
      </span>
    );
  });
}

export default function CoachPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "¡Hola! Soy tu coach financiero. Pregúntame cualquier cosa sobre tus finanzas: si puedes comprar algo, cómo ahorrar para una meta o cómo organizar tu presupuesto.",
      allowDeepAnalysis: false,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sonnetRemaining, setSonnetRemaining] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: settings } = useSWR<Settings>("/api/settings", fetcher);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (settings && sonnetRemaining === null) {
      setSonnetRemaining(settings.sonnetCallsLimit - settings.sonnetCallsThisMonth);
    }
  }, [settings, sonnetRemaining]);

  const sendMessage = useCallback(
    async (text: string, originalUserMsg?: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const isSonnetOptIn = trimmed.startsWith(SONNET_PREFIX);

      const userMsg: ChatMessage = {
        role: "user",
        content: isSonnetOptIn
          ? "🤖 Analizando con Sonnet..."
          : trimmed,
      };

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setInput("");
      setLoading(true);

      const history = updatedMessages
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        const res = await fetch(`${API_URL}/api/coach/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            conversationHistory: history.slice(0, -1),
            conversationId,
          }),
        });

        const data = (await res.json()) as {
          reply: string;
          modelUsed: "none" | "haiku" | "sonnet";
          allowDeepAnalysis?: boolean;
          budgetData?: BudgetData;
          suggestedActions?: string[];
          sonnetCallsRemaining?: number;
          conversationId?: string;
        };

        if (data.conversationId) setConversationId(data.conversationId);
        if (data.sonnetCallsRemaining !== undefined) setSonnetRemaining(data.sonnetCallsRemaining);

        // Track the original user message so we can re-send to Sonnet
        const lastUserMsg = originalUserMsg ?? (isSonnetOptIn ? undefined : trimmed);

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.reply,
            modelUsed: data.modelUsed,
            allowDeepAnalysis: data.allowDeepAnalysis && data.modelUsed !== "sonnet",
            originalUserMessage: lastUserMsg,
            budgetData: data.budgetData,
            suggestedActions: data.suggestedActions,
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Error al conectar con el servidor. Verifica que el servidor esté en funcionamiento.", modelUsed: "none" },
        ]);
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [messages, loading, conversationId]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleDeepAnalysis(originalMsg: string) {
    sendMessage(`${SONNET_PREFIX} ${originalMsg}`, originalMsg);
  }

  const limit = settings?.sonnetCallsLimit ?? 20;
  const used = settings ? settings.sonnetCallsThisMonth : 0;
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const remaining = sonnetRemaining ?? limit - used;

  return (
    <div className="flex flex-col h-screen bg-base">
      {/* Header */}
      <header className="border-b border-border bg-white px-4 md:px-6 py-3 shrink-0 shadow-sm">
        {/* Row 1: icon + title */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-teal to-teal-hover flex items-center justify-center shadow-sm shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h1 className="text-sm md:text-base font-bold text-hi leading-none">Coach Financiero IA</h1>
        </div>
        {/* Row 2: subtitle + sonnet chip */}
        <div className="flex items-center justify-between mt-2 gap-2">
          <p className="text-[11px] text-lo font-medium truncate">Respuestas instantáneas sin IA · Sonnet disponible</p>
          <div className="flex items-center gap-1.5 bg-raised rounded-lg px-2 py-1 border border-border shrink-0">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <div className="w-12 h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct > 80 ? "bg-danger" : pct > 50 ? "bg-warning" : "bg-purple"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={`text-[11px] font-bold ${remaining === 0 ? "text-danger" : "text-mid"}`}>
              {remaining}/{limit}
            </span>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal to-teal-hover flex items-center justify-center shrink-0 mr-3 mt-0.5 shadow-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
            )}
            <div className={`max-w-[72%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1.5`}>
              {/* Bubble */}
              <div
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  msg.role === "user"
                    ? "bg-gradient-to-br from-teal to-teal-hover text-white rounded-br-sm whitespace-pre-wrap"
                    : "bg-white text-hi rounded-bl-sm border border-border"
                }`}
              >
                {msg.role === "user" ? msg.content : parseMarkdown(msg.content)}
              </div>

              {/* Model chip */}
              {msg.role === "assistant" && msg.modelUsed && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${MODEL_CHIP[msg.modelUsed]?.color ?? "text-lo"}`}>
                  {MODEL_CHIP[msg.modelUsed]?.label ?? msg.modelUsed}
                </span>
              )}

              {/* Budget data card */}
              {msg.role === "assistant" && msg.budgetData && (
                <BudgetCard data={msg.budgetData} />
              )}

              {/* Suggested actions */}
              {msg.role === "assistant" && msg.suggestedActions && msg.suggestedActions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {msg.suggestedActions.map((action, j) => (
                    <button
                      key={j}
                      onClick={() => sendMessage(action)}
                      className="text-[11px] text-teal border border-teal/25 hover:bg-teal/10
                                 px-2.5 py-1 rounded-full transition-colors font-medium"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              )}

              {/* Deep analysis (Sonnet opt-in) button */}
              {msg.role === "assistant" &&
                msg.allowDeepAnalysis &&
                msg.originalUserMessage &&
                remaining > 0 && (
                  <button
                    onClick={() => handleDeepAnalysis(msg.originalUserMessage!)}
                    className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold
                               text-purple border border-purple/20 bg-purple/8 hover:bg-purple/12
                               px-3 py-1.5 rounded-full transition-all duration-200 hover:-translate-y-0.5"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    Razonar con IA (Sonnet · {remaining} restantes)
                  </button>
                )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal to-teal-hover flex items-center justify-center shrink-0 mr-3 shadow-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <div className="bg-white border border-border rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1.5 items-center">
                <span className="w-2 h-2 bg-teal/40 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-teal/40 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-teal/40 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick actions */}
      {messages.length <= 1 && (
        <div className="px-6 pb-3 flex flex-wrap gap-2 justify-center">
          {QUICK_ACTIONS.map((action, i) => (
            <button
              key={i}
              onClick={() => sendMessage(action)}
              className="text-xs text-mid border border-border hover:border-teal/40 hover:text-teal
                         hover:bg-teal/5 px-3.5 py-2 rounded-full transition-all duration-200 bg-white font-medium shadow-sm"
            >
              {action}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border bg-white px-6 py-4 shrink-0">
        <div className="flex gap-3 items-end max-w-4xl mx-auto">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Pregúntale algo a tu coach..."
            className="flex-1 input-light py-3"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none
                       disabled:shadow-none py-3 px-5"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Budget data visualization card ─────────────────────────────────────────── */

function BudgetCard({ data }: { data: BudgetData }) {
  if (data.type === "affordability") {
    return (
      <div className={`border rounded-xl p-3.5 text-xs mt-1 w-full max-w-xs shadow-sm ${
        data.canAfford ? "border-success/20 bg-success/8" : "border-danger/20 bg-danger/8"
      }`}>
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-lg">{data.canAfford ? "✅" : "❌"}</span>
          <span className={`font-bold text-sm ${data.canAfford ? "text-success" : "text-danger"}`}>
            {data.canAfford ? "Puedes comprarlo" : "No es posible por ahora"}
          </span>
        </div>
        {data.amount !== undefined && (
          <div className="text-mid mb-1">
            Compra: <span className="text-hi font-mono font-semibold">{formatCurrency(data.amount, data.currency ?? "ARS")}</span>
          </div>
        )}
        {data.availableBalance !== undefined && (
          <div className="text-mid mb-1">
            Saldo disponible: <span className="text-hi font-mono font-semibold">{formatCurrency(data.availableBalance)}</span>
          </div>
        )}
        {data.impact && (
          <div className="text-mid">
            Impacto: <span className={`font-bold ${IMPACT_COLOR[data.impact]}`}>
              {data.impact === "low" ? "bajo" : data.impact === "medium" ? "moderado" : "alto"}
            </span>
          </div>
        )}
      </div>
    );
  }

  if (data.type === "installments") {
    return (
      <div className={`border rounded-xl p-3.5 text-xs mt-1 w-full max-w-xs shadow-sm ${
        data.canAfford ? "border-success/20 bg-success/8" : "border-warning/20 bg-warning/8"
      }`}>
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-lg">{data.canAfford ? "✅" : "⚠️"}</span>
          <span className={`font-bold text-sm ${data.canAfford ? "text-success" : "text-warning"}`}>
            Análisis de cuotas
          </span>
        </div>
        {data.monthlyPayment !== undefined && (
          <div className="text-mid mb-1">
            Cuota mensual: <span className="text-hi font-mono font-semibold">{formatCurrency(data.monthlyPayment)}</span>
          </div>
        )}
        {data.amount !== undefined && (
          <div className="text-mid">
            Total: <span className="text-hi font-mono font-semibold">{formatCurrency(data.amount)}</span>
          </div>
        )}
      </div>
    );
  }

  if (data.type === "savings") {
    return (
      <div className="border border-sky/20 bg-sky/8 rounded-xl p-3.5 text-xs mt-1 w-full max-w-xs shadow-sm">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-lg">🎯</span>
          <span className="font-bold text-sm text-sky">Meta de ahorro</span>
        </div>
        {data.amount !== undefined && (
          <div className="text-mid mb-1">Meta: <span className="text-hi font-mono font-semibold">{formatCurrency(data.amount)}</span></div>
        )}
        {data.months !== undefined && (
          <div className="text-mid mb-1">Tiempo estimado: <span className="text-hi font-semibold">{data.months} meses</span></div>
        )}
        {data.targetDate && (
          <div className="text-mid mb-1">
            Fecha aprox.: <span className="text-hi">
              {new Date(data.targetDate).toLocaleDateString("es", { month: "long", year: "numeric" })}
            </span>
          </div>
        )}
        {data.currentMonthlySaving !== undefined && (
          <div className="text-mid">
            Ahorro actual: <span className="text-hi font-mono font-semibold">{formatCurrency(data.currentMonthlySaving)}/mes</span>
          </div>
        )}
      </div>
    );
  }

  return null;
}
