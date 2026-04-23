"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending]   = useState(false);
  const [done, setDone]     = useState(false);
  const [error, setError]   = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Indicá tu email");
      return;
    }
    setError("");
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (res.status === 400) {
        setError(data.error ?? "Revisá el email");
        return;
      }
      setDone(true);
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center p-6">
        <div className="text-center max-w-sm space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-success/10 border border-success/20 flex items-center justify-center mx-auto text-2xl">
            ✉️
          </div>
          <h1 className="text-2xl font-bold text-hi">Revisá tu bandeja</h1>
          <p className="text-mid text-sm leading-relaxed">
            Si {email} está registrado, en minutos deberías recibir un enlace para elegir una nueva
            contraseña (válido 1 hora).
          </p>
          <p className="text-lo text-xs">También mirá spam o promociones.</p>
          <Link href="/login" className="inline-block btn-primary text-sm px-6 py-2.5">
            ← Volver al inicio de sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
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
