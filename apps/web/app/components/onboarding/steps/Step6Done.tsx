"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Props {
  gmailConnected: boolean;
  webhookMp: boolean;
  webhookPaypal: boolean;
  webhookWise: boolean;
  onFinish: () => void;
}

export function Step6Done({ gmailConnected, webhookMp, webhookPaypal, webhookWise, onFinish }: Props) {
  const router = useRouter();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    // Fire confetti
    import("canvas-confetti").then(({ default: confetti }) => {
      const count = 200;
      const defaults = { origin: { y: 0.7 } };
      function fire(particleRatio: number, opts: object) {
        confetti({ ...defaults, ...opts, particleCount: Math.floor(count * particleRatio) });
      }
      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2,  { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
      fire(0.1,  { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fire(0.1,  { spread: 120, startVelocity: 45 });
    });
  }, []);

  const checks = [
    { label: "Gmail conectado",          done: gmailConnected },
    { label: "Reenvío de correos",       done: false },
    { label: "Historial CSV importado",  done: false },
    { label: "MercadoPago webhook",      done: webhookMp },
    { label: "PayPal webhook",           done: webhookPaypal },
    { label: "Wise webhook",             done: webhookWise },
  ];

  return (
    <div className="flex flex-col items-center text-center gap-6 px-4 py-8">
      <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-teal to-teal-hover flex items-center justify-center shadow-xl text-5xl">
        🎉
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-hi">¡Tu cuenta está lista!</h2>
        <p className="text-mid text-sm">
          Configuraste tu Coach Financiero IA. Podés ajustar cualquier cosa desde Configuración en cualquier momento.
        </p>
      </div>

      {/* Summary */}
      <div className="w-full max-w-xs space-y-2">
        {checks.map((item, i) => (
          <div key={i} className="flex items-center gap-3 text-left">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
              item.done
                ? "bg-success/15 text-success"
                : "bg-border/80 text-lo"
            }`}>
              {item.done ? "✓" : "—"}
            </span>
            <span className={`text-sm font-medium ${item.done ? "text-hi" : "text-lo"}`}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      <button
        onClick={() => {
          onFinish();
          router.push("/");
        }}
        className="btn-primary w-full max-w-xs py-3.5 text-base mt-2"
      >
        Ver mi dashboard →
      </button>
    </div>
  );
}
