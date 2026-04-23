"use client";

import { Suspense, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function ResetForm() {
  const sp     = useSearchParams();
  const token  = sp.get("token") ?? "";
  const router = useRouter();
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!pass || pass.length < 8) {
        setError("Mínimo 8 caracteres");
        return;
      }
      if (pass !== confirm) {
        setError("Las contraseñas no coinciden");
        return;
      }
      if (!token) {
        setError("Falta el token en el enlace. Usá el mail más reciente.");
        return;
      }
      setError("");
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/auth/reset-password`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ token, password: pass }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        if (!res.ok) {
          setError(data.error ?? "No se pudo actualizar");
          return;
        }
        setOk(true);
        setTimeout(() => router.replace("/login"), 2_000);
      } catch {
        setError("No se pudo conectar con el servidor");
      } finally {
        setLoading(false);
      }
    },
    [token, pass, confirm, router],
  );

  if (!token) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center p-6">
        <div className="text-center max-w-sm space-y-3">
          <h1 className="text-lg font-bold text-hi">Enlace inválido</h1>
          <p className="text-mid text-sm">Abrí el enlace del correo o pedí uno nuevo en recuperar contraseña.</p>
          <Link href="/forgot-password" className="text-teal font-medium">Pedir enlace otra vez</Link>
        </div>
      </div>
    );
  }

  if (ok) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <p className="text-hi font-semibold">Listo, contraseña actualizada.</p>
          <p className="text-mid text-sm mt-2">Te llevamos al inicio de sesión…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-hi text-center">Nueva contraseña</h1>
        <p className="text-mid text-sm text-center">Elegí una clave de al menos 8 caracteres.</p>
        <form onSubmit={onSubmit} className="card p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-mid mb-1.5">Nueva contraseña</label>
            <input
              type="password"
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-mid mb-1.5">Repetir</label>
            <input
              type="password"
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          {error && <p className="text-rose-600 text-sm font-medium">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {loading ? "Guardando…" : "Guardar y entrar"}
          </button>
        </form>
        <p className="text-center text-sm text-lo">
          <Link href="/login" className="text-teal">← Volver al login</Link>
        </p>
      </div>
    </div>
  );
}

function Fallback() {
  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-6 text-mid text-sm">
      Cargando…
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <ResetForm />
    </Suspense>
  );
}
