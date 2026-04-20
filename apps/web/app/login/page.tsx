"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const { token } = await res.json();
        localStorage.setItem("coach_token", token);
        router.push("/");
      } else {
        setError("Contraseña incorrecta");
      }
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex items-center justify-center min-h-screen bg-base">
      <form
        onSubmit={handleSubmit}
        className="card p-8 w-full max-w-sm flex flex-col gap-4 shadow-lg"
      >
        <div className="flex flex-col items-center gap-2 mb-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal to-teal-hover flex items-center justify-center shadow-md">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-hi">Coach Financiero IA</h1>
          <p className="text-xs text-lo">Ingresa tu contraseña para continuar</p>
        </div>
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-light"
          autoFocus
        />
        {error && <p className="text-danger text-sm text-center">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-gradient-to-r from-teal to-teal-hover text-white font-semibold
                     rounded-xl px-4 py-2.5 transition-all hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
