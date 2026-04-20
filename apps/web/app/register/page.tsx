"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/* ── Password strength ───────────────────────────────────────────────────── */

function getStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (pw.length === 0) return { level: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { level: 1, label: "Débil", color: "bg-danger" };
  if (score === 2) return { level: 2, label: "Media", color: "bg-warning" };
  return { level: 3, label: "Fuerte", color: "bg-success" };
}

/* ── Right column preview ────────────────────────────────────────────────── */

const STATS = [
  { value: "3.2M+", label: "transacciones analizadas" },
  { value: "98%",   label: "precisión en categorías" },
  { value: "24h",   label: "soporte promedio" },
];

function RightColumn() {
  return (
    <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-[#0d9488] to-[#0f766e] p-12 relative overflow-hidden">
      <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/5 rounded-full" />
      <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-white/5 rounded-full" />

      <div className="relative z-10">
        <span className="inline-flex items-center gap-1.5 text-white/60 text-xs font-semibold tracking-widest uppercase">
          <span className="text-white/80">✦</span> ÚNETE A QUIENES YA CONTROLAN SUS FINANZAS
        </span>

        <h2 className="text-white text-3xl font-bold mt-6 leading-tight">
          Toma el control<br />de tu dinero.
        </h2>
        <p className="text-white/70 text-sm mt-3 leading-relaxed max-w-xs">
          Coach Financiero IA analiza cada movimiento y te da insights personalizados para que llegues a tus metas más rápido.
        </p>
      </div>

      <div className="relative z-10 space-y-3">
        {STATS.map(({ value, label }) => (
          <div key={value} className="bg-white/10 border border-white/15 rounded-xl px-5 py-3.5 flex items-center gap-4">
            <span className="text-white font-bold text-2xl">{value}</span>
            <span className="text-white/70 text-sm">{label}</span>
          </div>
        ))}
      </div>

      <div className="relative z-10">
        <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-3">Compatible con</p>
        <div className="flex items-center gap-3 flex-wrap">
          {["Mercado Pago", "PayPal", "Wise", "Galicia", "BBVA"].map((name) => (
            <span
              key={name}
              className="bg-white/10 border border-white/15 text-white/70 text-[11px] font-medium rounded-lg px-2.5 py-1"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Logo ────────────────────────────────────────────────────────────────── */

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal to-teal-hover flex items-center justify-center shadow-sm">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      </div>
      <div className="leading-tight">
        <p className="text-hi font-bold text-sm">Coach Financiero</p>
        <p className="text-lo text-[10px] font-medium">IA Personal Finance</p>
      </div>
    </div>
  );
}

/* ── Toast ───────────────────────────────────────────────────────────────── */

function Toast({ msg, onHide }: { msg: string; onHide: () => void }) {
  useEffect(() => {
    const t = setTimeout(onHide, 3000);
    return () => clearTimeout(t);
  }, [onHide]);
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-hi text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg z-50">
      {msg}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const router = useRouter();
  const toastHideRef = useRef(() => setToast(""));

  const strength = getStrength(password);

  // Redirect if already logged in
  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("coach_token")) {
      router.replace("/");
    }
  }, [router]);

  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "El nombre es obligatorio";
    if (!email) errs.email = "El email es obligatorio";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Formato de email inválido";
    if (!password) errs.password = "La contraseña es obligatoria";
    else if (password.length < 8) errs.password = "Mínimo 8 caracteres";
    if (password !== confirm) errs.confirm = "Las contraseñas no coinciden";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (res.status === 201) {
        router.push("/waitlist-pending");
      } else if (res.status === 409) {
        setFieldErrors({ email: "Este email ya está registrado" });
      } else {
        setError(data.error ?? "Ocurrió un error. Intenta de nuevo.");
      }
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {toast && <Toast msg={toast} onHide={toastHideRef.current} />}

      {/* ── Left column ─────────────────────────────────────────────────── */}
      <div className="flex flex-col justify-between bg-white px-8 py-8 md:px-12 lg:px-16">
        <Logo />

        <div className="flex-1 flex items-center justify-center py-8">
          <div className="w-full max-w-sm">
            <h1 className="text-3xl md:text-4xl font-bold text-hi leading-tight mb-1">
              Crea tu cuenta,
            </h1>
            <h1 className="text-3xl md:text-4xl font-bold text-success leading-tight mb-4">
              es gratis.
            </h1>
            <p className="text-mid text-sm leading-relaxed mb-8">
              Conecta tus finanzas y empieza a recibir insights de tu coach IA.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lo">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Nombre completo"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setFieldErrors((p) => ({ ...p, name: "" })); }}
                    className={`input-light w-full pl-10 py-3 ${fieldErrors.name ? "border-danger focus:border-danger" : ""}`}
                    autoComplete="name"
                    autoFocus
                  />
                </div>
                {fieldErrors.name && <p className="text-danger text-xs mt-1">{fieldErrors.name}</p>}
              </div>

              {/* Email */}
              <div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lo">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22 6 12 13 2 6" />
                    </svg>
                  </span>
                  <input
                    type="email"
                    placeholder="tucorreo@email.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: "" })); }}
                    className={`input-light w-full pl-10 py-3 ${fieldErrors.email ? "border-danger focus:border-danger" : ""}`}
                    autoComplete="email"
                  />
                </div>
                {fieldErrors.email && <p className="text-danger text-xs mt-1">{fieldErrors.email}</p>}
              </div>

              {/* Password */}
              <div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lo">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Contraseña (mín. 8 caracteres)"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: "" })); }}
                    className={`input-light w-full pl-10 pr-10 py-3 ${fieldErrors.password ? "border-danger focus:border-danger" : ""}`}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-lo hover:text-mid transition-colors"
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Strength indicator */}
                {password.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
                            strength.level >= i ? strength.color : "bg-border"
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs font-medium ${
                      strength.level === 1 ? "text-danger" :
                      strength.level === 2 ? "text-warning" : "text-success"
                    }`}>
                      {strength.label}
                    </p>
                  </div>
                )}
                {fieldErrors.password && <p className="text-danger text-xs mt-1">{fieldErrors.password}</p>}
              </div>

              {/* Confirm password */}
              <div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lo">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirmar contraseña"
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); setFieldErrors((p) => ({ ...p, confirm: "" })); }}
                    className={`input-light w-full pl-10 py-3 ${fieldErrors.confirm ? "border-danger focus:border-danger" : ""}`}
                    autoComplete="new-password"
                  />
                </div>
                {fieldErrors.confirm && <p className="text-danger text-xs mt-1">{fieldErrors.confirm}</p>}
              </div>

              {error && (
                <p className="text-danger text-sm bg-danger/8 border border-danger/20 rounded-xl px-4 py-2.5">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-3 text-base disabled:opacity-50 disabled:transform-none disabled:shadow-none disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creando cuenta…
                  </span>
                ) : "Crear cuenta →"}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-border" />
                <span className="text-lo text-[11px] font-semibold tracking-wider">O CONTINUAR CON</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Google button */}
              <button
                type="button"
                onClick={() => setToast("Google OAuth — próximamente disponible")}
                className="w-full flex items-center justify-center gap-3 border border-border bg-white hover:bg-raised rounded-xl py-3 text-hi text-sm font-semibold transition-all shadow-sm hover:shadow-md"
              >
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v8.51h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.14z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.16C6.51 42.62 14.62 48 24 48z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.5-1.45-.78-3-.78-4.59s.28-3.14.78-4.59l-7.98-6.16C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.16C12.43 13.72 17.74 9.5 24 9.5z"/>
                </svg>
                Continuar con Google
              </button>

              {/* Terms */}
              <p className="text-center text-[11px] text-lo leading-relaxed">
                Al registrarte aceptas los{" "}
                <Link href="/terms" className="text-teal hover:underline">Términos de servicio</Link>
                {" "}y la{" "}
                <Link href="/privacy" className="text-teal hover:underline">Política de privacidad</Link>
              </p>
            </form>

            <p className="text-center text-sm text-mid mt-6">
              ¿Ya tienes cuenta?{" "}
              <Link href="/login" className="text-teal hover:text-teal-hover font-semibold transition-colors">
                Inicia sesión
              </Link>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-lo">
          <span>v2.5 · Prompt 5</span>
          <div className="flex gap-3">
            <Link href="/terms" className="hover:text-mid transition-colors">Términos</Link>
            <Link href="/privacy" className="hover:text-mid transition-colors">Privacidad</Link>
          </div>
        </div>
      </div>

      <RightColumn />
    </div>
  );
}
