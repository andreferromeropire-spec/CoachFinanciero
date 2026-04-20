"use client";

import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="text-center max-w-sm space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-teal/10 border border-teal/20 flex items-center justify-center mx-auto">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-hi">Recuperar contraseña</h1>
        <p className="text-mid text-sm leading-relaxed">
          Esta función estará disponible próximamente.
          Por ahora, contacta al administrador para restablecer tu contraseña.
        </p>
        <Link
          href="/login"
          className="inline-block btn-primary text-sm px-6 py-2.5"
        >
          ← Volver al inicio de sesión
        </Link>
      </div>
    </div>
  );
}
