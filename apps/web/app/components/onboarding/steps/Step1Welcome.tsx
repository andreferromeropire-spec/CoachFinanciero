"use client";

interface Props {
  onNext: () => void;
}

export function Step1Welcome({ onNext }: Props) {
  return (
    <div className="flex flex-col items-center text-center px-4 py-8 gap-6">
      <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-teal to-teal-hover flex items-center justify-center shadow-xl">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      </div>

      <div className="space-y-3 max-w-sm">
        <h2 className="text-2xl font-bold text-hi">Bienvenido/a a Coach Financiero IA 👋</h2>
        <p className="text-mid text-sm leading-relaxed">
          En 5 minutos vas a tener tus finanzas conectadas.
          Te vamos a guiar paso a paso para que el coach tenga toda la info que necesita.
        </p>
      </div>

      <div className="w-full max-w-xs space-y-3 mt-2">
        {["Conectar tu Gmail", "Reenvío automático", "Importar historial bancario", "Conectar MercadoPago, PayPal y Wise"].map((item, i) => (
          <div key={i} className="flex items-center gap-3 text-left">
            <div className="w-6 h-6 rounded-full bg-teal/15 text-teal flex items-center justify-center text-xs font-bold shrink-0">
              {i + 1}
            </div>
            <span className="text-sm text-mid font-medium">{item}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onNext}
        className="btn-primary w-full max-w-xs mt-4 py-3 text-base"
      >
        Empezar configuración →
      </button>
    </div>
  );
}
