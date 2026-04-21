"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("Iniciando sesión con Google…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get("token");
    const error  = params.get("error");

    if (token) {
      localStorage.setItem("coach_token", token);
      router.replace("/");
    } else {
      const msgs: Record<string, string> = {
        google_cancelado:   "Cancelaste el inicio con Google.",
        google_token:       "Error al obtener el token de Google.",
        google_sin_email:   "Google no devolvió un email.",
        cuenta_bloqueada:   "Tu cuenta está bloqueada.",
        google_error:       "Error al iniciar sesión con Google.",
      };
      setMsg(msgs[error ?? ""] ?? "Error desconocido.");
      setTimeout(() => router.replace(`/login`), 2500);
    }
  }, [router]);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#f8fafc", fontFamily: '"Inter", system-ui, sans-serif',
    }}>
      <div style={{ textAlign: "center", color: "#475569" }}>
        <div style={{
          width: 40, height: 40, border: "3px solid #e2e8f0", borderTopColor: "#14b8a6",
          borderRadius: "50%", animation: "spin .7s linear infinite",
          margin: "0 auto 16px",
        }}/>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ fontSize: 15, fontWeight: 500 }}>{msg}</p>
      </div>
    </div>
  );
}
