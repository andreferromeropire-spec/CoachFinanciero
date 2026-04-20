"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../../../lib/api";

interface Props {
  onNext: () => void;
  onSkip: () => void;
}

export function Step3Forwarding({ onNext, onSkip }: Props) {
  const [ingestEmail, setIngestEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiFetch<{ email: string }>("/api/settings/ingest-email")
      .then((d) => setIngestEmail(d.email))
      .catch(() => setIngestEmail("ingest@coachfinanciero.app"));
  }, []);

  function handleCopy() {
    if (!ingestEmail) return;
    navigator.clipboard.writeText(ingestEmail).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const STEPS = [
    "En tu otro correo, andá a Configuración → Reenvío",
    <span key="2">Agregá esta dirección de reenvío:</span>,
    "Confirmá el código que llegue a esta app",
  ];

  return (
    <div className="flex flex-col gap-6 px-2">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-2xl bg-sky/10 border border-sky/20 flex items-center justify-center mx-auto mb-2">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-hi">Reenvío automático</h2>
        <p className="text-sm text-mid leading-relaxed max-w-sm mx-auto">
          Si recibís mails de bancos o apps en otras casillas,
          podés reenviarlos automáticamente a esta app.
        </p>
      </div>

      <div className="space-y-4">
        {STEPS.map((step, i) => (
          <div key={i}>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-sky/15 text-sky flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                {i + 1}
              </div>
              <div className="text-sm text-mid leading-relaxed pt-1">{step}</div>
            </div>
            {i === 1 && ingestEmail && (
              <div className="mt-2 ml-10 flex items-center gap-2">
                <div className="flex-1 bg-teal/8 border border-teal/20 rounded-xl px-4 py-2.5 font-mono text-sm text-teal truncate">
                  {ingestEmail}
                </div>
                <button
                  onClick={handleCopy}
                  className="shrink-0 px-3 py-2.5 bg-teal text-white rounded-xl text-xs font-semibold hover:bg-teal-hover transition-colors"
                >
                  {copied ? "✓" : "Copiar"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-raised rounded-xl p-4 border border-border text-xs text-mid">
        <p className="font-semibold text-hi mb-1.5">Remitentes sugeridos para filtrar</p>
        <p className="leading-relaxed">
          alertas@galicia.com.ar, notificaciones@brubank.com, noreply@mercadopago.com,
          no-reply@bbva.com.ar, noreply@pedidosya.com, uber.receipts@uber.com
        </p>
      </div>

      <div className="flex gap-3">
        <button onClick={onSkip} className="flex-1 border border-border text-mid hover:text-hi hover:border-hi rounded-xl py-3 text-sm font-semibold transition-all">
          Omitir por ahora
        </button>
        <button onClick={onNext} className="flex-1 btn-primary py-3">
          Ya configuré el reenvío →
        </button>
      </div>
    </div>
  );
}
