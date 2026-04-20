"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const CF = {
  teal:         '#14b8a6',
  tealDark:     '#0d9488',
  tealSoft:     '#ccfbf1',
  tealTint:     '#f0fdfa',
  lavenderSoft: '#ede9fe',
  lavenderTint: '#f5f3ff',
  rose:         '#f43f5e',
  roseSoft:     '#ffe4e6',
  green:        '#10b981',
  greenSoft:    '#d1fae5',
  bg:           '#f8fafc',
  card:         '#ffffff',
  border:       '#e5e7eb',
  borderSoft:   '#eef2f6',
  text:         '#0f172a',
  textMuted:    '#475569',
  textSubtle:   '#94a3b8',
  font:         '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días 👋";
  if (h < 19) return "Buenas tardes 👋";
  return "Buenas noches 👋";
}

function Field({ label, placeholder, type = "text", icon, value, onChange, suffix, autoFocus }: {
  label: string; placeholder: string; type?: string; icon: React.ReactNode;
  value: string; onChange: (v: string) => void; suffix?: React.ReactNode; autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: CF.textMuted, marginBottom: 6 }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: CF.textSubtle, display: 'flex', pointerEvents: 'none' }}>
          {icon}
        </span>
        <input
          type={type} placeholder={placeholder} value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          autoFocus={autoFocus}
          style={{
            width: '100%', padding: '11px 12px 11px 38px',
            background: CF.card, border: `1.5px solid ${focused ? CF.teal : CF.border}`,
            borderRadius: 10, fontSize: 14, color: CF.text, outline: 'none',
            fontFamily: CF.font, boxSizing: 'border-box' as const,
            boxShadow: focused ? `0 0 0 3px ${CF.teal}1a` : 'none',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
        />
        {suffix && (
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

const IconMail = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22 6 12 13 2 6"/>
  </svg>
);
const IconLock = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const IconGoogle = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"/>
    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83Z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"/>
  </svg>
);

function MiniDashboard() {
  const sparkD = "M2 26 L14 21 L26 23 L38 15 L50 17 L62 11 L74 13 L88 5";
  return (
    <div style={{
      background: CF.card, border: `1px solid ${CF.borderSoft}`, borderRadius: 16, padding: '20px 22px',
      boxShadow: '0 20px 60px -20px rgba(15,23,42,0.15), 0 4px 16px rgba(15,23,42,0.04)',
      transform: 'rotate(-0.5deg)',
    }}>
      {/* Ingresos + Gastos row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        {/* Income */}
        <div style={{ flex: 1, padding: '12px 14px', background: CF.bg, borderRadius: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: 7, background: CF.greenSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 15l7-7 7 7" stroke={CF.green} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: CF.green, padding: '2px 6px', background: CF.greenSoft, borderRadius: 4 }}>+12%</span>
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: CF.textSubtle, letterSpacing: 0.4, textTransform: 'uppercase' as const }}>Ingresos del mes</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: CF.text, marginTop: 3, letterSpacing: -0.3 }}>$ 284.500</div>
        </div>
        {/* Expenses */}
        <div style={{ flex: 1, padding: '12px 14px', background: CF.bg, borderRadius: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: 7, background: CF.roseSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M19 9l-7 7-7-7" stroke={CF.rose} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: CF.rose, padding: '2px 6px', background: CF.roseSoft, borderRadius: 4 }}>-8%</span>
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: CF.textSubtle, letterSpacing: 0.4, textTransform: 'uppercase' as const }}>Gastos del mes</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: CF.text, marginTop: 3, letterSpacing: -0.3 }}>$ 198.200</div>
        </div>
      </div>
      {/* Balance + sparkline */}
      <div style={{ background: CF.bg, borderRadius: 10, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: CF.textSubtle, letterSpacing: 0.4, textTransform: 'uppercase' as const }}>Balance disponible</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: CF.text, marginTop: 4, letterSpacing: -0.5 }}>$ 86.300</div>
        </div>
        <svg width="90" height="32" viewBox="0 0 90 32">
          <path d={sparkD} stroke={CF.teal} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          <path d={`${sparkD} L88 32 L2 32 Z`} fill={CF.tealSoft} opacity="0.5"/>
        </svg>
      </div>
    </div>
  );
}

function Toast({ msg, onHide }: { msg: string; onHide: () => void }) {
  useEffect(() => { const t = setTimeout(onHide, 2800); return () => clearTimeout(t); }, [onHide]);
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: CF.text, color: '#fff', fontSize: 13, fontWeight: 500,
      padding: '10px 20px', borderRadius: 10, zIndex: 100, whiteSpace: 'nowrap' as const,
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)', fontFamily: CF.font,
    }}>
      {msg}
    </div>
  );
}

export default function LoginPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [toast, setToast]       = useState("");
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("coach_token")) {
      router.replace("/");
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError("Completa todos los campos"); return; }
    setLoading(true); setError("");
    try {
      const res  = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("coach_token", data.token);
        router.push("/");
      } else if (res.status === 403 && data.waitlist) {
        router.push("/waitlist-pending");
      } else {
        setError("Email o contraseña incorrectos");
      }
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .login-root {
          display: flex;
          height: 100vh;
          width: 100vw;
          overflow: hidden;
          font-family: ${CF.font};
          color: ${CF.text};
        }

        /* ── LEFT ── */
        .login-left {
          width: 480px;
          flex-shrink: 0;
          background: ${CF.card};
          display: flex;
          flex-direction: column;
          padding: 36px 52px;
          overflow-y: auto;
          box-sizing: border-box;
        }
        .login-form-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          max-width: 360px;
        }

        /* ── RIGHT ── */
        .login-right {
          flex: 1;
          background: linear-gradient(160deg, ${CF.tealTint} 0%, ${CF.lavenderTint} 100%);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 52px 52px 40px;
          position: relative;
          overflow: hidden;
        }
        .login-right-deco1 {
          position: absolute; top: -100px; right: -100px;
          width: 340px; height: 340px; border-radius: 50%;
          background: ${CF.tealSoft}; opacity: 0.6; filter: blur(30px);
          pointer-events: none;
        }
        .login-right-deco2 {
          position: absolute; bottom: -60px; left: 60px;
          width: 240px; height: 240px; border-radius: 50%;
          background: ${CF.lavenderSoft}; opacity: 0.45; filter: blur(40px);
          pointer-events: none;
        }

        /* ── TABLET (768-1024px) ── */
        @media (max-width: 1024px) and (min-width: 768px) {
          .login-left  { width: 420px; padding: 32px 40px; }
          .login-right { padding: 44px 40px 36px; }
        }

        /* ── MOBILE (<768px) ── */
        @media (max-width: 767px) {
          html, body { overflow: auto; }
          .login-root  { height: auto; min-height: 100vh; flex-direction: column; }
          .login-left  {
            width: 100%; flex-shrink: unset;
            padding: 44px 28px 36px;
            background: linear-gradient(180deg, ${CF.tealTint} 0%, #fff 38%);
            position: relative; overflow: visible;
          }
          .login-left::before {
            content: '';
            position: absolute; top: -50px; right: -60px;
            width: 240px; height: 240px; border-radius: 50%;
            background: ${CF.tealSoft}; filter: blur(50px); opacity: 0.7;
            pointer-events: none;
          }
          .login-left::after {
            content: '';
            position: absolute; top: 160px; left: -60px;
            width: 200px; height: 200px; border-radius: 50%;
            background: ${CF.lavenderSoft}; filter: blur(60px); opacity: 0.5;
            pointer-events: none;
          }
          .login-form-area { max-width: 100%; }
          .login-right { display: none; }
        }
      `}</style>

      {toast && <Toast msg={toast} onHide={() => setToast("")} />}

      <div className="login-root">

        {/* ── LEFT COLUMN ──────────────────────────────────────────────── */}
        <div className="login-left">

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 0 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: `linear-gradient(135deg, ${CF.teal}, ${CF.tealDark})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 12px ${CF.teal}44`,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: CF.text, lineHeight: 1.15 }}>Coach Financiero</div>
              <div style={{ fontSize: 10.5, color: CF.textSubtle, fontWeight: 500 }}>IA Personal Finance</div>
            </div>
          </div>

          {/* Form area */}
          <div className="login-form-area">
            {/* Greeting pill */}
            <div style={{
              display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 7,
              padding: '5px 11px', borderRadius: 999,
              background: CF.tealTint, border: `1px solid ${CF.tealSoft}`,
              fontSize: 12, fontWeight: 500, color: CF.tealDark, marginBottom: 20,
            }}>
              {greeting()}
            </div>

            <h1 style={{ fontSize: 34, fontWeight: 600, letterSpacing: -0.8, lineHeight: 1.08, margin: '0 0 10px' }}>
              Tus finanzas,<br/>
              <span style={{ color: CF.tealDark }}>en un solo lugar.</span>
            </h1>
            <p style={{ fontSize: 14.5, color: CF.textMuted, margin: '0 0 30px', lineHeight: 1.55 }}>
              Crea tu cuenta y empieza a ver el balance del mes y a charlar con tu coach IA.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <Field label="Correo electrónico" placeholder="tu@ejemplo.com" icon={<IconMail/>} value={email} onChange={setEmail} autoFocus />
              <div style={{ height: 14 }}/>
              <Field
                label="Contraseña" placeholder="••••••••" type="password"
                icon={<IconLock/>} value={password} onChange={setPassword}
                suffix={
                  <Link href="/forgot-password" style={{ fontSize: 12, color: CF.tealDark, fontWeight: 500, textDecoration: 'none' }}>
                    ¿Olvidaste?
                  </Link>
                }
              />

              {error && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 8, fontSize: 13, color: '#e11d48' }}>
                  {error}
                </div>
              )}

              {/* Primary CTA */}
              <button type="submit" disabled={loading} style={{
                marginTop: 22, padding: '13px 18px',
                background: loading ? `${CF.teal}aa` : CF.teal,
                color: '#fff', border: 'none', borderRadius: 11,
                fontSize: 14.5, fontWeight: 600, fontFamily: CF.font, cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: `0 1px 2px rgba(13,148,136,0.3), 0 8px 20px -4px ${CF.teal}66, inset 0 1px 0 rgba(255,255,255,0.2)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'opacity 0.15s',
              }}>
                {loading ? (
                  <>
                    <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }}/>
                    Entrando…
                  </>
                ) : (
                  <>
                    Empezar gratis
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12h14m0 0-6-6m6 6-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </>
                )}
              </button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0 12px' }}>
                <div style={{ flex: 1, height: 1, background: CF.borderSoft }}/>
                <span style={{ fontSize: 11, color: CF.textSubtle, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 500 }}>
                  o continuar con
                </span>
                <div style={{ flex: 1, height: 1, background: CF.borderSoft }}/>
              </div>

              {/* Google */}
              <button type="button" onClick={() => setToast("Google OAuth — próximamente disponible")} style={{
                width: '100%', padding: '12px 18px',
                background: CF.card, color: CF.text,
                border: `1.5px solid ${CF.border}`, borderRadius: 11,
                fontSize: 14, fontWeight: 500, fontFamily: CF.font, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                transition: 'background 0.15s',
              }}>
                <IconGoogle/>
                Continuar con Google
              </button>
            </form>

            {/* Security note */}
            <div style={{ marginTop: 16, fontSize: 12, color: CF.textSubtle, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Cifrado extremo a extremo · Acceso con contraseña única
            </div>

            {/* Register link */}
            <p style={{ marginTop: 18, fontSize: 13.5, color: CF.textMuted, textAlign: 'center' }}>
              ¿No tienes cuenta?{" "}
              <Link href="/register" style={{ color: CF.tealDark, fontWeight: 600, textDecoration: 'none' }}>
                Regístrate
              </Link>
            </p>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: CF.textSubtle }}>
            <span>v2.5 · Prompt 5</span>
            <div style={{ display: 'flex', gap: 12 }}>
              <Link href="/terms"   style={{ color: CF.textMuted, textDecoration: 'none' }}>Términos</Link>
              <Link href="/privacy" style={{ color: CF.textMuted, textDecoration: 'none' }}>Privacidad</Link>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ─────────────────────────────────────────────── */}
        <div className="login-right">
          <div className="login-right-deco1"/>
          <div className="login-right-deco2"/>

          {/* TOP: Coach quote */}
          <div style={{ position: 'relative', maxWidth: 560 }}>
            <div style={{
              fontSize: 12.5, fontWeight: 600, color: CF.tealDark, letterSpacing: 0.6,
              textTransform: 'uppercase', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', background: CF.teal,
                boxShadow: `0 0 0 4px ${CF.tealSoft}`, display: 'inline-block', flexShrink: 0,
              }}/>
              Tu coach, esta mañana
            </div>
            <div style={{ fontSize: 27, fontWeight: 500, color: CF.text, letterSpacing: -0.5, lineHeight: 1.3 }}>
              "Este mes gastaste un 12% menos en comida.
              Si mantienes el ritmo, llegas a tu meta de ahorro en{" "}
              <span style={{ color: CF.tealDark, fontWeight: 600 }}>3 meses</span>."
            </div>
          </div>

          {/* MIDDLE: Mini dashboard */}
          <div style={{ position: 'relative' }}>
            <MiniDashboard/>
          </div>

          {/* BOTTOM: Integrations */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: CF.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginRight: 4 }}>
              Conectado con
            </span>
            {["Mercado Pago", "PayPal", "Wise", "Galicia", "BBVA"].map(name => (
              <span key={name} style={{
                padding: '5px 10px', background: 'rgba(255,255,255,0.75)',
                border: `1px solid ${CF.borderSoft}`, borderRadius: 6,
                fontSize: 11, fontWeight: 500, color: CF.textMuted,
                backdropFilter: 'blur(8px)',
              }}>
                {name}
              </span>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}
