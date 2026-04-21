"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const C = {
  teal:      "#14b8a6",
  tealDark:  "#0d9488",
  tealSoft:  "#ccfbf1",
  tealTint:  "#f0fdfa",
  lavender:  "#ede9fe",
  rose:      "#f43f5e",
  roseSoft:  "#ffe4e6",
  green:     "#10b981",
  greenSoft: "#d1fae5",
  bg:        "#f8fafc",
  white:     "#ffffff",
  border:    "#e2e8f0",
  borderFt:  "#f1f5f9",
  text:      "#0f172a",
  mid:       "#475569",
  lo:        "#94a3b8",
  font:      '"Inter", system-ui, -apple-system, sans-serif',
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días 👋";
  if (h < 19) return "Buenas tardes 👋";
  return "Buenas noches 👋";
}

const inputStyle = (focused: boolean) => ({
  width: "100%", padding: "11px 12px 11px 38px",
  background: C.white, border: `1.5px solid ${focused ? C.teal : C.border}`,
  borderRadius: 10, fontSize: 14, color: C.text, outline: "none",
  boxShadow: focused ? `0 0 0 3px ${C.teal}1a` : "none",
  transition: "border-color .15s, box-shadow .15s",
});

const iconWrap: React.CSSProperties = {
  position: "absolute", left: 12, top: "50%",
  transform: "translateY(-50%)", color: C.lo,
  display: "flex", pointerEvents: "none",
};

export default function LoginPage() {
  const [mode, setMode]         = useState<"login" | "register">("register");
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [fName, setFName]       = useState(false);
  const [fEmail, setFEmail]     = useState(false);
  const [fPass,  setFPass]      = useState(false);
  const [fConf,  setFConf]      = useState(false);
  const [greet, setGreet]       = useState("Bienvenido 👋");
  const router = useRouter();

  useEffect(() => { setGreet(greeting()); }, []);
  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("coach_token")) {
      router.replace("/");
    }
  }, [router]);

  function switchMode(m: "login" | "register") {
    setMode(m); setError("");
    setName(""); setEmail(""); setPassword(""); setConfirm("");
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (mode === "register") {
      if (!name.trim() || !email || !password) { setError("Completá todos los campos"); return; }
      if (password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres"); return; }
      if (password !== confirm) { setError("Las contraseñas no coinciden"); return; }
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), email, password }),
        });
        let data: { token?: string; error?: string } = {};
        try { data = await res.json(); } catch { /* no-JSON */ }
        if ((res.status === 201 || res.ok) && data.token) {
          localStorage.setItem("coach_token", data.token);
          router.push("/");
        } else if (res.status === 409) {
          setError("Ese email ya tiene una cuenta. Iniciá sesión.");
        } else if (res.status === 500) {
          setError("Error del servidor. Intentá de nuevo.");
        } else {
          setError(data.error ?? "Error al crear la cuenta");
        }
      } catch {
        setError("No se pudo conectar con el servidor");
      } finally { setLoading(false); }

    } else {
      if (!email || !password) { setError("Completá todos los campos"); return; }
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        let data: { token?: string; error?: string; waitlist?: boolean } = {};
        try { data = await res.json(); } catch { /* no-JSON */ }
        if (res.ok && data.token) {
          localStorage.setItem("coach_token", data.token);
          router.push("/");
        } else if (res.status === 403 && data.waitlist) {
          setError("Tu cuenta está pendiente de aprobación");
        } else if (res.status === 403) {
          setError("Tu cuenta está bloqueada");
        } else if (res.status === 500) {
          setError("Error del servidor. Intentá de nuevo en unos segundos");
        } else {
          setError("Email o contraseña incorrectos");
        }
      } catch {
        setError("No se pudo conectar con el servidor");
      } finally { setLoading(false); }
    }
  }, [mode, name, email, password, confirm, router]);

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; font-family: ${C.font}; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .lr { display: flex; width: 100vw; height: 100vh; overflow: hidden; }
        .ll {
          width: 420px; min-width: 420px; max-width: 420px;
          background: ${C.white}; display: flex; flex-direction: column;
          justify-content: space-between; padding: 2.5rem 2.5rem; overflow-y: auto;
        }
        .ll-inner { width: 100%; display: flex; flex-direction: column; }
        .lright {
          flex: 1; min-width: 0;
          background: linear-gradient(155deg, ${C.tealTint} 0%, #f5f3ff 100%);
          display: flex; align-items: center; justify-content: center;
          position: relative; overflow: hidden; padding: 3rem;
        }
        .lright::before {
          content: ""; position: absolute; top: -120px; right: -120px;
          width: 400px; height: 400px; border-radius: 50%;
          background: ${C.tealSoft}; opacity: 0.55; filter: blur(40px); pointer-events: none;
        }
        .lright::after {
          content: ""; position: absolute; bottom: -80px; left: 40px;
          width: 280px; height: 280px; border-radius: 50%;
          background: ${C.lavender}; opacity: 0.4; filter: blur(50px); pointer-events: none;
        }
        .lright-inner {
          width: 100%; max-width: 520px; display: flex; flex-direction: column;
          gap: 0; position: relative; z-index: 1;
        }
        input { font-family: ${C.font}; }
        @media (max-width: 768px) {
          .lr { flex-direction: column; height: auto; min-height: 100vh; overflow: auto; }
          .ll { width: 100%; min-width: 0; max-width: 100%; height: auto; padding: 2.5rem 1.5rem; }
          .lright { display: none; }
        }
      `}</style>

      <div className="lr">

        {/* ══════════ LEFT ══════════ */}
        <div className="ll">

          {/* Logo */}
          <div style={{ width: "100%", maxWidth: 380 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: `linear-gradient(135deg, ${C.teal}, ${C.tealDark})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 4px 12px ${C.teal}44`,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>Coach Financiero</div>
                <div style={{ fontSize: 10.5, color: C.lo, fontWeight: 500 }}>IA Personal Finance</div>
              </div>
            </div>
          </div>

          {/* Form block */}
          <div className="ll-inner">

            {/* Badge */}
            <div style={{
              display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 999,
              background: C.tealTint, border: `1px solid ${C.tealSoft}`,
              fontSize: 12, fontWeight: 500, color: C.tealDark, marginBottom: 16,
            }}>
              {mode === "register" ? "Empezar gratis 🚀" : greet}
            </div>

            <h1 style={{ fontSize: 29, fontWeight: 600, letterSpacing: -0.7, lineHeight: 1.1, marginBottom: 8 }}>
              {mode === "register"
                ? (<>Tus finanzas,<br/><span style={{ color: C.tealDark }}>en un solo lugar.</span></>)
                : (<>Bienvenido<br/><span style={{ color: C.tealDark }}>de vuelta.</span></>)
              }
            </h1>
            <p style={{ fontSize: 13.5, color: C.mid, lineHeight: 1.6, marginBottom: 22 }}>
              {mode === "register"
                ? "Creá tu cuenta y empezá a ver tu balance y charlar con tu coach IA."
                : "Ingresá para ver tu panel financiero personalizado."}
            </p>

            {/* NAME — solo registro */}
            {mode === "register" && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: C.mid, marginBottom: 6 }}>Nombre</label>
                <div style={{ position: "relative" }}>
                  <span style={iconWrap}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                  </span>
                  <input type="text" placeholder="Tu nombre" value={name} onChange={e => setName(e.target.value)}
                    onFocus={() => setFName(true)} onBlur={() => setFName(false)} autoFocus style={inputStyle(fName)} />
                </div>
              </div>
            )}

            {/* EMAIL */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: C.mid, marginBottom: 6 }}>Correo electrónico</label>
              <div style={{ position: "relative" }}>
                <span style={iconWrap}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/>
                  </svg>
                </span>
                <input type="email" placeholder="tu@ejemplo.com" value={email} onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFEmail(true)} onBlur={() => setFEmail(false)}
                  autoFocus={mode === "login"} style={inputStyle(fEmail)} />
              </div>
            </div>

            {/* PASSWORD */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ fontSize: 12.5, fontWeight: 500, color: C.mid }}>Contraseña</label>
                {mode === "login" && <span style={{ fontSize: 12, color: C.lo, fontWeight: 500 }}>¿Olvidaste?</span>}
              </div>
              <div style={{ position: "relative" }}>
                <span style={iconWrap}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input type="password" placeholder={mode === "register" ? "Mínimo 8 caracteres" : "••••••••"}
                  value={password} onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFPass(true)} onBlur={() => setFPass(false)} style={inputStyle(fPass)} />
              </div>
            </div>

            {/* CONFIRM — solo registro */}
            {mode === "register" && (
              <div style={{ marginBottom: 0 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: C.mid, marginBottom: 6 }}>Confirmar contraseña</label>
                <div style={{ position: "relative" }}>
                  <span style={iconWrap}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </span>
                  <input type="password" placeholder="Repetí la contraseña" value={confirm} onChange={e => setConfirm(e.target.value)}
                    onFocus={() => setFConf(true)} onBlur={() => setFConf(false)} style={inputStyle(fConf)} />
                </div>
              </div>
            )}

            {/* ERROR */}
            {error && (
              <div style={{ marginTop: 12, padding: "10px 14px", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 8, fontSize: 13, color: "#e11d48" }}>
                {error}
              </div>
            )}

            {/* SUBMIT */}
            <button onClick={handleSubmit as never} disabled={loading} style={{
              marginTop: 18, width: "100%", padding: "13px 18px",
              background: loading ? `${C.teal}99` : C.teal,
              color: "#fff", border: "none", borderRadius: 11,
              fontSize: 14.5, fontWeight: 600, fontFamily: C.font,
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: `0 8px 20px -4px ${C.teal}55, inset 0 1px 0 rgba(255,255,255,0.2)`,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "opacity .15s",
            }}>
              {loading ? (
                <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite", display: "inline-block" }}/>
                  {mode === "register" ? "Creando cuenta…" : "Entrando…"}</>
              ) : (
                <>{mode === "register" ? "Crear cuenta gratis" : "Iniciar sesión"}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m0 0-6-6m6 6-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></>
              )}
            </button>

            {/* DIVIDER */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0 12px" }}>
              <div style={{ flex: 1, height: 1, background: C.borderFt }}/>
              <span style={{ fontSize: 11, color: C.lo, letterSpacing: 0.6, textTransform: "uppercase", fontWeight: 500 }}>o continuar con</span>
              <div style={{ flex: 1, height: 1, background: C.borderFt }}/>
            </div>

            {/* GOOGLE — próximamente */}
            <button type="button" title="Próximamente" disabled style={{
              width: "100%", padding: "11px 18px",
              background: C.bg, color: C.lo, opacity: 0.65,
              border: `1.5px solid ${C.borderFt}`, borderRadius: 11,
              fontSize: 14, fontWeight: 500, fontFamily: C.font, cursor: "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"/>
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83Z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"/>
              </svg>
              Iniciar con Google · Próximamente
            </button>

            {/* SWITCH MODE */}
            <div style={{ marginTop: 20, textAlign: "center", fontSize: 13.5, color: C.mid }}>
              {mode === "register" ? (
                <>¿Ya tenés cuenta?{" "}
                  <button type="button" onClick={() => switchMode("login")} style={{ background: "none", border: "none", color: C.tealDark, fontWeight: 600, fontSize: 13.5, cursor: "pointer", fontFamily: C.font, padding: 0 }}>
                    Iniciar sesión
                  </button>
                </>
              ) : (
                <>¿No tenés cuenta?{" "}
                  <button type="button" onClick={() => switchMode("register")} style={{ background: "none", border: "none", color: C.tealDark, fontWeight: 600, fontSize: 13.5, cursor: "pointer", fontFamily: C.font, padding: 0 }}>
                    Registrarse — es gratis
                  </button>
                </>
              )}
            </div>

            {/* SECURITY */}
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, color: C.lo }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Cifrado extremo a extremo · Datos privados
            </div>
          </div>

          {/* Footer */}
          <div style={{ width: "100%", maxWidth: 380, display: "flex", justifyContent: "space-between", fontSize: 12, color: C.lo }}>
            <span>v2.5</span>
            <div style={{ display: "flex", gap: 14 }}>
              <span>Términos</span>
              <span>Privacidad</span>
            </div>
          </div>

        </div>{/* end LEFT */}

        {/* ══════════ RIGHT ══════════ */}
        <div className="lright">
          <div className="lright-inner">

            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.teal, boxShadow: `0 0 0 4px ${C.tealSoft}`, display: "inline-block", flexShrink: 0 }}/>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.tealDark, letterSpacing: 0.8, textTransform: "uppercase" as const }}>Tu coach, esta mañana</span>
              </div>
              <p style={{ fontSize: 22, fontWeight: 500, color: C.text, letterSpacing: -0.4, lineHeight: 1.35 }}>
                "Este mes gastaste un 12% menos en comida.
                Si mantenés el ritmo, llegás a tu meta de ahorro en{" "}
                <span style={{ color: C.tealDark, fontWeight: 700 }}>3 meses</span>."
              </p>
            </div>

            <div style={{
              background: C.white, border: `1px solid ${C.borderFt}`, borderRadius: 18,
              padding: "20px 22px",
              boxShadow: "0 20px 50px -14px rgba(15,23,42,0.13), 0 4px 14px rgba(15,23,42,0.04)",
              transform: "rotate(-0.4deg)",
            }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                {[
                  { label: "Ingresos del mes", value: "$ 284.500", pct: "+12%", color: C.green, soft: C.greenSoft, up: true },
                  { label: "Gastos del mes",   value: "$ 198.200", pct: "-8%",  color: C.rose,  soft: C.roseSoft,  up: false },
                ].map(k => (
                  <div key={k.label} style={{ flex: 1, padding: "13px 15px", background: C.bg, borderRadius: 11 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 7, background: k.soft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {k.up
                          ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 15l7-7 7 7" stroke={k.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          : <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M19 9l-7 7-7-7" stroke={k.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        }
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: k.color, padding: "2px 6px", background: k.soft, borderRadius: 4 }}>{k.pct}</span>
                    </div>
                    <div style={{ fontSize: 9.5, fontWeight: 600, color: C.lo, letterSpacing: 0.5, textTransform: "uppercase" as const }}>{k.label}</div>
                    <div style={{ fontSize: 17, fontWeight: 600, color: C.text, marginTop: 3, letterSpacing: -0.3 }}>{k.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: C.bg, borderRadius: 11, padding: "13px 15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 9.5, fontWeight: 600, color: C.lo, letterSpacing: 0.5, textTransform: "uppercase" as const }}>Balance disponible</div>
                  <div style={{ fontSize: 21, fontWeight: 600, color: C.text, marginTop: 3, letterSpacing: -0.5 }}>$ 86.300</div>
                </div>
                <svg width="130" height="36" viewBox="0 0 130 36">
                  <path d="M2 30 L18 24 L34 27 L52 17 L68 19 L86 12 L104 14 L128 5" stroke={C.teal} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 30 L18 24 L34 27 L52 17 L68 19 L86 12 L104 14 L128 5 L128 36 L2 36 Z" fill={C.tealSoft} opacity="0.38"/>
                </svg>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" as const, marginTop: 20 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: C.mid, letterSpacing: 0.6, textTransform: "uppercase" as const, marginRight: 2 }}>Conectado con</span>
              {["Mercado Pago", "PayPal", "Wise", "Galicia", "BBVA"].map(n => (
                <span key={n} style={{ padding: "5px 10px", background: "rgba(255,255,255,0.75)", border: `1px solid ${C.borderFt}`, borderRadius: 6, fontSize: 11, fontWeight: 500, color: C.mid }}>
                  {n}
                </span>
              ))}
            </div>

          </div>
        </div>

      </div>
    </>
  );
}
