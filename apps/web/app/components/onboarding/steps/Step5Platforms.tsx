"use client";

import { useState } from "react";

interface Props {
  onNext: (state: { mp: boolean; paypal: boolean; wise: boolean }) => void;
  onSkip: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://coachfinanciero-production.up.railway.app";

const PLATFORMS = [
  {
    id: "mp" as const,
    label: "MercadoPago",
    emoji: "💙",
    color: "blue",
    steps: [
      "Andá a tu cuenta MP → Tu negocio → Webhooks",
      "Hacé click en \"Crear webhook\"",
      "Pegá la URL de abajo y seleccioná el evento: payment",
    ],
    webhookUrl: `${API_URL}/api/webhooks/mp`,
  },
  {
    id: "paypal" as const,
    label: "PayPal",
    emoji: "🔵",
    color: "sky",
    steps: [
      "Dashboard PayPal → Developer → Webhooks → Add webhook",
      "Pegá la URL de abajo",
      "Eventos: PAYMENT.CAPTURE.COMPLETED, PAYMENT.SALE.COMPLETED",
    ],
    webhookUrl: `${API_URL}/api/webhooks/paypal`,
  },
  {
    id: "wise" as const,
    label: "Wise",
    emoji: "🟢",
    color: "green",
    steps: [
      "Wise → Settings → Developer tools → Webhooks",
      "Add webhook → Pegá la URL de abajo",
      "Seleccioná eventos de transferencia",
    ],
    webhookUrl: `${API_URL}/api/webhooks/wise`,
  },
];

export function Step5Platforms({ onNext, onSkip }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [configured, setConfigured] = useState({ mp: false, paypal: false, wise: false });
  const [copied, setCopied] = useState<string | null>(null);

  function handleCopy(url: string, id: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function toggleConfigured(id: "mp" | "paypal" | "wise") {
    setConfigured((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="flex flex-col gap-5 px-2">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-2xl bg-purple/10 border border-purple/20 flex items-center justify-center mx-auto mb-2">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10" />
            <path d="M16 3v4M8 3v4M3 11h18M16.5 19.5 18 21l3-3" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-hi">Conectá tus plataformas de pago</h2>
        <p className="text-sm text-mid leading-relaxed max-w-sm mx-auto">
          Así cada pago se registra automáticamente sin que hagas nada.
        </p>
      </div>

      <div className="space-y-3">
        {PLATFORMS.map((platform) => {
          const isOpen = expanded === platform.id;
          const isConfigured = configured[platform.id];

          return (
            <div
              key={platform.id}
              className={`border rounded-xl overflow-hidden transition-all duration-200 ${
                isConfigured ? "border-success/30 bg-success/3" : "border-border"
              }`}
            >
              <button
                onClick={() => setExpanded(isOpen ? null : platform.id)}
                className="w-full flex items-center justify-between px-4 py-3.5"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{platform.emoji}</span>
                  <span className="font-semibold text-hi text-sm">{platform.label}</span>
                  {isConfigured && (
                    <span className="text-xs bg-success/15 text-success border border-success/20 rounded-full px-2 py-0.5 font-medium">
                      Configurado ✓
                    </span>
                  )}
                </div>
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className={`text-lo transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 border-t border-border pt-4 space-y-4">
                  <div className="space-y-2.5">
                    {platform.steps.map((step, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs text-mid">
                        <span className="w-5 h-5 rounded-full bg-teal/15 text-teal flex items-center justify-center font-bold shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span className="leading-relaxed pt-0.5">{step}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-teal/8 border border-teal/20 rounded-xl px-3 py-2 font-mono text-xs text-teal truncate">
                      {platform.webhookUrl}
                    </div>
                    <button
                      onClick={() => handleCopy(platform.webhookUrl, platform.id)}
                      className="shrink-0 px-3 py-2 bg-teal text-white rounded-xl text-xs font-semibold hover:bg-teal-hover transition-colors"
                    >
                      {copied === platform.id ? "✓" : "Copiar"}
                    </button>
                  </div>

                  <button
                    onClick={() => toggleConfigured(platform.id)}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                      isConfigured
                        ? "border-success/30 bg-success/10 text-success"
                        : "border-border text-mid hover:border-teal hover:text-teal"
                    }`}
                  >
                    {isConfigured ? "✓ Marcado como configurado" : "Marcar como configurado"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        <button onClick={onSkip} className="flex-1 border border-border text-mid hover:text-hi hover:border-hi rounded-xl py-3 text-sm font-semibold transition-all">
          Omitir
        </button>
        <button onClick={() => onNext(configured)} className="flex-1 btn-primary py-3">
          Continuar →
        </button>
      </div>
    </div>
  );
}
