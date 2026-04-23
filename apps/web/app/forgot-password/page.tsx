"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Llena el ancho del <body> (flex) para que justify-center centre el bloque en PC */
const SHELL =
  "w-full flex-1 min-w-0 min-h-screen bg-page flex items-center justify-center p-6";

type ForgotOutcome =
  | "email_sent"
  | "not_registered"
  | "account_blocked"
  | "send_failed"
  | "resend_unconfigured";

const OUTCOME_COPY: Record<
  ForgotOutcome,
  { title: string; body: string; hint?: string; tone: "ok" | "info" | "err" }
> = {
  email_sent: {
    title:  "Revisá tu bandeja",
    body:   "En minutos deberías recibir un enlace en tu correo para elegir una nueva contraseña (válido 1 hora).",
    hint:   "También mirá spam o promociones.",
    tone:   "ok",
  },
  not_registered: {
    title:  "No hay cuenta con ese email",
    body:   "Revisá que el correo esté bien escrito o create una en registro / inicio de sesión.",
    tone:   "info",
  },
  account_blocked: {
    title:  "No podés recuperar esta cuenta",
    body:   "Esta cuenta no está habilitada para recibir enlace de recuperación. Escribinos si necesitás ayuda.",
    tone:   "err",
  },
  send_failed: {
    title:  "No pudimos enviar el correo",
    body:   "El servidor no pudo entregar el email (límite del proveedor, dominio no verificado, etc.). Probá de nuevo en un rato. Si administra el proyecto, revisá en Resend el remitente y resend.com/domains.",
    tone:   "err",
  },
  resend_unconfigured: {
    title:  "Correo no configurado",
    body:   "Falta RESEND_API_KEY en el servidor. En local, el enlace a veces se muestra en la consola del API.",
    tone:   "err",
  },
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome]   = useState<ForgotOutcome | null>(null);
  const [error, setError]       = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Indicá tu email");
      return;
    }
    setError("");
    setSending(true);
    setOutcome(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        outcome?: string;
        error?: string;
      };
      if (res.status === 400) {
        setError(data.error ?? "Revisá el email");
        return;
      }
      if (res.status >= 500) {
        setError(data.error ?? "Error del servidor. Probá de nuevo.");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "No se pudo completar el pedido.");
        return;
      }
      const o = data.outcome;
      if (
        o === "email_sent" ||
        o === "not_registered" ||
        o === "account_blocked" ||
        o === "send_failed" ||
        o === "resend_unconfigured"
      ) {
        setOutcome(o);
        return;
      }
      setError("Respuesta inesperada del servidor");
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setSending(false);
    }
  }

  if (outcome && OUTCOME_COPY[outcome]) {
    const copy = OUTCOME_COPY[outcome];
    const isOk  = copy.tone === "ok";
    const iconBox =
      copy.tone === "ok"
        ? "bg-success/10 border-success/20"
        : copy.tone === "info"
          ? "bg-teal/10 border-teal/20"
          : "bg-rose-100 border-rose-200";
    return (
      <div className={SHELL}>
        <div className="w-full max-w-md mx-auto text-center space-y-4">
          <div
            className={`w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto text-2xl ${iconBox}`}
          >
            {isOk ? "✉️" : copy.tone === "info" ? "📭" : "⚠️"}
          </div>
          <h1 className="text-2xl font-bold text-hi">{copy.title}</h1>
          <p className="text-mid text-sm leading-relaxed">{copy.body}</p>
          {copy.hint && <p className="text-lo text-xs">{copy.hint}</p>}
          {outcome === "email_sent" && (
            <p className="text-mid text-sm font-medium">
              Aviso enviado a: <span className="text-hi">{email.trim()}</span>
            </p>
          )}
          <Link href="/login" className="inline-block btn-primary text-sm px-6 py-2.5">
            ← Volver al inicio de sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={SHELL}>
      <div className="w-full max-w-md mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-teal/10 border border-teal/20 flex items-center justify-center mx-auto">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-hi">Recuperar contraseña</h1>
          <p className="text-mid text-sm">Te enviamos un enlace a tu email.</p>
        </div>
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-mid mb-1.5">Email</label>
            <input
              type="email"
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-hi placeholder:text-lo focus:border-teal focus:ring-2 focus:ring-teal/20 outline-none"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          {error && <p className="text-rose-600 text-sm font-medium">{error}</p>}
          <button
            type="submit"
            disabled={sending}
            className="w-full btn-primary py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {sending ? "Enviando…" : "Enviar enlace"}
          </button>
        </form>
        <p className="text-center text-sm text-lo">
          <Link href="/login" className="text-teal font-medium hover:underline">← Volver a iniciar sesión</Link>
        </p>
      </div>
    </div>
  );
}
