"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const SHELL =
  "w-full flex-1 min-w-0 min-h-screen bg-page flex items-center justify-center p-6";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("coach_token");
}

export default function VerifyEmailPage() {
  const router  = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading]   = useState(false);
  const [resend, setResend]     = useState(false);
  const [error, setError]       = useState("");
  const [done, setDone]         = useState(false);
  const [unconfigured, setUn]   = useState(false);
  const [bootMessage, setBootMessage] = useState("");
  const bootSendOnce = useRef(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
    }
  }, [router]);

  /** Pide un código; fromBoot: primer envío al abrir (usuarios viejos sin verificar; ref evita 2× en React Strict) */
  const sendCode = useCallback(
    async (fromBoot = false) => {
      const t = getToken();
      if (!t) {
        setError("Sesión no encontrada. Iniciá sesión de nuevo.");
        return;
      }
      setError("");
      if (fromBoot) {
        setBootMessage("Enviando código a tu correo…");
      }
      if (!fromBoot) setResend(true);
      try {
        const r = await fetch(`${API_URL}/api/auth/send-verification-email`, {
          method:  "POST",
          headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        });
        const d = (await r.json().catch(() => ({}))) as { outcome?: string; error?: string; ok?: boolean };
        if (r.status === 401) {
          setError("Sesión vencida. Iniciá sesión de nuevo.");
          if (fromBoot) setBootMessage("");
          return;
        }
        if (d.outcome === "unconfigured") {
          setUn(true);
          setError("Falta RESEND en el servidor; en la consola del API puede aparecer el código en desarrollo.");
          if (fromBoot) setBootMessage("");
          return;
        }
        if (d.outcome === "already") {
          setError("");
          if (fromBoot) {
            setBootMessage("");
            router.replace("/");
          }
          return;
        }
        if (d.outcome === "sent" || d.ok) {
          setError("");
          if (fromBoot) {
            setBootMessage("Listo, revisá tu bandeja (o spam) y pega el código abajo.");
          }
          return;
        }
        if (d.outcome === "send_failed") {
          setError("No se pudo enviar el email. Revisá Resend y reintentá.");
          if (fromBoot) setBootMessage("");
          return;
        }
        if (fromBoot) setBootMessage("");
      } catch {
        setError("No se pudo conectar con el servidor");
        if (fromBoot) setBootMessage("");
      } finally {
        if (!fromBoot) setResend(false);
      }
    },
    [router],
  );

  useEffect(() => {
    if (bootSendOnce.current) return;
    if (typeof window === "undefined" || !getToken()) return;
    bootSendOnce.current = true;
    void sendCode(true);
  }, [sendCode]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const digits = code.replace(/\D/g, "");
      if (digits.length !== 6) {
        setError("Escribí los 6 números");
        return;
      }
      const t = getToken();
      if (!t) {
        setError("Sesión no encontrada");
        return;
      }
      setError("");
      setLoading(true);
      try {
        const r = await fetch(`${API_URL}/api/auth/verify-email-code`, {
          method:  "POST",
          headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
          body:    JSON.stringify({ code: digits }),
        });
        const d = (await r.json().catch(() => ({}))) as { error?: string; already?: boolean };
        if (r.status === 401) {
          setError("Sesión vencida. Iniciá sesión de nuevo.");
          return;
        }
        if (d.already) {
          setDone(true);
          setTimeout(() => router.replace("/"), 800);
          return;
        }
        if (!r.ok) {
          setError(d.error ?? "No se pudo verificar");
          return;
        }
        setDone(true);
        setTimeout(() => router.replace("/"), 800);
      } catch {
        setError("Error de conexión");
      } finally {
        setLoading(false);
      }
    },
    [code, router],
  );

  if (done) {
    return (
      <div className={SHELL}>
        <div className="w-full max-w-md mx-auto text-center space-y-2">
          <p className="text-hi font-semibold">Listo, email verificado</p>
          <p className="text-mid text-sm">Te redirigimos a la app…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={SHELL}>
      <div className="w-full max-w-md mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-hi">Verificá tu email</h1>
          <p className="text-mid text-sm">
            Código de 6 números, válido 10 min. Si no te llega, usá <strong>Reenviar</strong> y mirá spam.
          </p>
          {bootMessage && <p className="text-sm text-teal font-medium text-center">{bootMessage}</p>}
        </div>
        <form onSubmit={onSubmit} className="card p-6 space-y-4">
          {unconfigured && (
            <p className="text-amber-800 text-sm bg-amber-50 border border-amber-200 rounded-lg p-2">
              Modo dev: mirá el log del API por el código si no hay Resend.
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-mid mb-1.5">Código</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={8}
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-hi text-center text-lg tracking-widest font-mono"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </div>
          {error && <p className="text-rose-600 text-sm font-medium">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {loading ? "Comprobando…" : "Confirmar"}
          </button>
        </form>
        <p className="text-center text-sm text-lo">
          <button
            type="button"
            disabled={resend}
            onClick={() => void sendCode()}
            className="text-teal font-medium hover:underline disabled:opacity-50"
          >
            {resend ? "Reenviando…" : "Reenviar código"}
          </button>
          <span className="mx-2">·</span>
          <Link href="/" className="text-mid">Ir a la app</Link>
        </p>
      </div>
    </div>
  );
}
