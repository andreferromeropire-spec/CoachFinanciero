"use client";

import Link from "next/link";

export default function WaitlistPendingPage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="text-center max-w-sm space-y-5">
        <div className="text-7xl mb-2">🎉</div>
        <h1 className="text-3xl font-bold text-hi">¡Ya estás en la lista!</h1>
        <p className="text-mid text-sm leading-relaxed">
          Revisamos tu solicitud y te avisamos por email cuando tu cuenta esté lista.
          Suele tardar menos de 24 horas.
        </p>
        <p className="text-lo text-xs">
          Mientras tanto, puedes seguirnos en Instagram{" "}
          <span className="text-teal font-semibold">@coachfinanciero</span>
        </p>
        <Link
          href="/login"
          className="inline-block text-sm text-mid hover:text-hi border border-border rounded-xl px-4 py-2 transition-colors"
        >
          Volver al inicio de sesión
        </Link>
      </div>
    </div>
  );
}
