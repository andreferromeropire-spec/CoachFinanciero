"use client";

import { useState } from "react";
import { apiFetch } from "../../../../lib/api";

interface Props {
  onNext: (gmailConnected: boolean) => void;
  onSkip: () => void;
}

interface ImapTestResult { ok: boolean; error?: string }

const IMAP_STEPS = [
  "Abrí Gmail → Configuración → Ver toda la configuración",
  "Andá a la pestaña \"Reenvío e IMAP\" → Activar IMAP",
  "En Google → Seguridad → Contraseñas de apps → Generá una contraseña",
];

export function Step2Gmail({ onNext, onSkip }: Props) {
  const [showImap, setShowImap] = useState(false);
  const [imapUser, setImapUser] = useState("");
  const [imapPass, setImapPass] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ImapTestResult | null>(null);
  const [gmailConnected] = useState(false);

  async function handleTestImap() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await apiFetch<ImapTestResult>("/api/settings/imap/test", {
        method: "POST",
        body: JSON.stringify({ user: imapUser, password: imapPass }),
      });
      setTestResult(result);
    } catch {
      setTestResult({ ok: false, error: "No se pudo conectar. Verificá los datos e intentá de nuevo." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-2">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-2">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <rect width="20" height="16" x="2" y="4" rx="2" fill="#EA4335" opacity="0.15" />
            <polyline points="22 7 12 13 2 7" stroke="#EA4335" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-hi">Conectá tu Gmail</h2>
        <p className="text-sm text-mid leading-relaxed max-w-sm mx-auto">
          Le damos permiso a la app para <strong>leer</strong> tus mails de bancos,
          PedidosYa, Rappi, MercadoLibre, Uber y más.
          Solo lectura — nunca enviamos nada.
        </p>
      </div>

      {gmailConnected ? (
        <div className="flex items-center gap-3 bg-success/8 border border-success/20 rounded-xl px-5 py-4">
          <span className="text-2xl">✅</span>
          <span className="text-success font-semibold text-sm">Gmail conectado</span>
        </div>
      ) : (
        <button
          className="w-full flex items-center justify-center gap-3 border-2 border-border bg-white hover:bg-raised rounded-xl py-3.5 font-semibold text-hi text-sm transition-all duration-200 shadow-sm hover:shadow-md"
          onClick={() => alert("Google OAuth requiere configurar credenciales en Google Cloud Console. Usá la opción IMAP manual por ahora.")}
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v8.51h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.14z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.16C6.51 42.62 14.62 48 24 48z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.5-1.45-.78-3-.78-4.59s.28-3.14.78-4.59l-7.98-6.16C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.16C12.43 13.72 17.74 9.5 24 9.5z"/>
          </svg>
          Conectar Gmail con Google
        </button>
      )}

      {/* IMAP fallback */}
      <div className="border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => setShowImap(!showImap)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-mid hover:text-hi hover:bg-raised/50 transition-colors"
        >
          <span className="font-medium">¿Preferís configurarlo manualmente? (IMAP)</span>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={`transition-transform duration-200 ${showImap ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {showImap && (
          <div className="px-4 pb-4 border-t border-border space-y-4 pt-4">
            <div className="space-y-2">
              {IMAP_STEPS.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5 text-xs text-mid">
                  <span className="w-5 h-5 rounded-full bg-teal/15 text-teal flex items-center justify-center font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <input
                type="email"
                placeholder="tu@gmail.com"
                value={imapUser}
                onChange={(e) => setImapUser(e.target.value)}
                className="input-light w-full text-sm"
              />
              <input
                type="password"
                placeholder="App Password (16 caracteres)"
                value={imapPass}
                onChange={(e) => setImapPass(e.target.value)}
                className="input-light w-full text-sm"
              />
              <button
                onClick={handleTestImap}
                disabled={testing || !imapUser || !imapPass}
                className="btn-primary w-full text-sm py-2.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
              >
                {testing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Probando conexión…
                  </span>
                ) : "Probar conexión"}
              </button>
            </div>

            {testResult && (
              <div className={`rounded-xl px-4 py-3 text-sm flex items-center gap-2 ${testResult.ok ? "bg-success/8 border border-success/20 text-success" : "bg-danger/8 border border-danger/20 text-danger"}`}>
                <span>{testResult.ok ? "✅" : "⚠️"}</span>
                <span>{testResult.ok ? "Conexión exitosa — configuración guardada" : testResult.error}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={() => onNext(testResult?.ok ?? false)}
          className="btn-primary flex-1 py-3"
        >
          {testResult?.ok ? "Continuar →" : "Omitir este paso"}
        </button>
      </div>
    </div>
  );
}
