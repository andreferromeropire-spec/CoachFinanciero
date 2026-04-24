import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "@coach/db";
import { createAccessToken, getUserIdFromAccessToken } from "../middleware/auth";
import {
  REFRESH_COOKIE,
  createRefreshTokenRecord,
  readRefreshFromCookie,
  revokeRefreshValue,
  validateRefreshValue,
} from "../services/refreshTokenService";
import { requestPasswordReset, resetPasswordWithToken } from "../services/passwordResetService";
import { sendEmailVerification, confirmEmailCode } from "../services/emailVerificationService";
import { deleteAllUserData } from "../services/deleteUserAccountService";
export const authRouter = Router();

const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const GOOGLE_REDIRECT_URI  = process.env.GOOGLE_REDIRECT_URI  ?? "http://localhost:4000/api/auth/google/callback";
const FRONTEND_URL         = process.env.PUBLIC_WEB_URL       ?? "http://localhost:3000";

function sessionUserFromDb(u: {
  id: string; email: string; name: string | null; isAdmin: boolean; emailVerifiedAt?: Date | null;
}) {
  return {
    id:              u.id,
    email:           u.email,
    name:            u.name,
    isAdmin:         u.isAdmin,
    emailVerifiedAt: u.emailVerifiedAt ? u.emailVerifiedAt.toISOString() : null,
  };
}

function refreshCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true     as const,
    secure:   isProd   as boolean,
    sameSite: (isProd ? "none" : "lax") as "none" | "lax",
    maxAge:   30 * 24 * 60 * 60 * 1000,
    path:     "/",
  };
}

/**
 * Callback OAuth de Gmail. Preferí definir GOOGLE_REDIRECT_URI como el de login
 * (.../api/auth/google/callback) y dejar que se derive el de Gmail; o bien
 * GOOGLE_GMAIL_REDIRECT_URI con la URL completa en Google Cloud Console.
 * No usar .replace("/callback") suelto: rompe si la URI ya contiene /gmail/callback.
 */
function resolveGmailRedirectUri(): string {
  const explicit = (process.env.GOOGLE_GMAIL_REDIRECT_URI ?? "").trim().replace(/\/+$/, "");
  if (explicit) return explicit;

  const login = (process.env.GOOGLE_REDIRECT_URI ?? "").trim().replace(/\/+$/, "");
  if (!login) return "";

  if (login.endsWith("/api/auth/google/gmail/callback")) {
    return login;
  }
  if (login.endsWith("/api/auth/google/callback")) {
    return login.replace(/\/api\/auth\/google\/callback$/, "/api/auth/google/gmail/callback");
  }

  console.warn(
    "[auth] GOOGLE_REDIRECT_URI debe terminar en /api/auth/google/callback (login). Valor recibido (truncado):",
    login.slice(0, 120),
  );
  return "";
}

// POST /api/auth/login
authRouter.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  const emailNorm = email.trim().toLowerCase();

  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: emailNorm, mode: "insensitive" } },
    });
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const status = (user as { status?: string }).status;
    if (status === "waitlist") {
      res.status(403).json({ error: "Account pending approval", waitlist: true });
      return;
    }

    if (status === "blocked") {
      res.status(403).json({ error: "Account blocked" });
      return;
    }

    const accessToken = createAccessToken(user.id);
    const refreshRaw  = await createRefreshTokenRecord(user.id, req);
    res.cookie(REFRESH_COOKIE, refreshRaw, refreshCookieOptions());
    res.json({ token: accessToken, user: sessionUserFromDb(user) });
  } catch (err) {
    console.error("[auth/login]", err);
    res.status(500).json({ error: "Server error, please try again" });
  }
});

// POST /api/auth/register
authRouter.post("/register", async (req: Request, res: Response) => {
  const { name, email, password } = req.body as {
    name?: string; email?: string; password?: string;
  };

  if (!name || !email || !password) {
    res.status(400).json({ error: "name, email and password are required" });
    return;
  }

  const emailNorm = email.trim().toLowerCase();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailNorm)) {
    res.status(400).json({ error: "Invalid email format" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  try {
    const existing = await prisma.user.findFirst({
      where: { email: { equals: emailNorm, mode: "insensitive" } },
    });
    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const hash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { name, email: emailNorm, password: hash, status: "active" },
    });

    await prisma.userSettings.create({ data: { userId: user.id } });

    const accessToken = createAccessToken(user.id);
    const refreshRaw  = await createRefreshTokenRecord(user.id, req);
    res.cookie(REFRESH_COOKIE, refreshRaw, refreshCookieOptions());
    // El mail con el código se envía al abrir /verify-email (también cuentas ya registradas sin verificar)
    res.status(201).json({ token: accessToken, user: sessionUserFromDb(user) });
  } catch (err) {
    console.error("[auth/register]", err);
    res.status(500).json({ error: "Server error, please try again" });
  }
});

// GET /api/auth/google/gmail — OAuth con scope gmail.readonly (con JWT en state)
authRouter.get("/google/gmail", (req: Request, res: Response) => {
  const gmailRedirectUri = resolveGmailRedirectUri();
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    res.redirect(`${FRONTEND_URL}/settings?gmail_error=oauth_no_configurado`);
    return;
  }
  if (!gmailRedirectUri) {
    res.redirect(`${FRONTEND_URL}/settings?gmail_error=falta_redirect_uri`);
    return;
  }
  const token = req.headers.authorization?.slice(7) ?? (req.query.token as string) ?? "";
  const params = new URLSearchParams({
    client_id:     GOOGLE_CLIENT_ID,
    redirect_uri:  gmailRedirectUri,
    response_type: "code",
    scope:         "openid email https://www.googleapis.com/auth/gmail.readonly",
    access_type:   "offline",
    prompt:        "consent",
    state:         encodeURIComponent(token),
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// GET /api/auth/google/gmail/callback
authRouter.get("/google/gmail/callback", async (req: Request, res: Response) => {
  const { code, state, error } = req.query as { code?: string; state?: string; error?: string };
  const jwtToken = state ? decodeURIComponent(state) : "";

  if (error || !code) {
    res.redirect(`${FRONTEND_URL}/settings?gmail_error=cancelado`);
    return;
  }

  // Decodificar JWT para obtener userId
  let userId = "default-user";
  try {
    const jwt = await import("jsonwebtoken");
    const payload = jwt.default.verify(jwtToken, process.env.JWT_SECRET ?? "coach-financiero-dev-secret") as { userId: string };
    userId = payload.userId;
  } catch { /* usa default-user */ }

  try {
    const gmailRedirectUri = resolveGmailRedirectUri();
    if (!gmailRedirectUri) {
      res.redirect(`${FRONTEND_URL}/settings?gmail_error=falta_redirect_uri`);
      return;
    }

    // Intercambiar code por tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri:  gmailRedirectUri,
        grant_type:    "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json() as {
      access_token?: string; refresh_token?: string; expires_in?: number;
    };

    if (!tokenData.access_token) {
      res.redirect(`${FRONTEND_URL}/settings?gmail_error=token`);
      return;
    }

    // Obtener email de la cuenta Gmail
    const infoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const info = await infoRes.json() as { email?: string };

    if (!info.email) {
      res.redirect(`${FRONTEND_URL}/settings?gmail_error=sin_email`);
      return;
    }

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : undefined;

    // Guardar o actualizar la cuenta conectada
    await prisma.connectedEmail.upsert({
      where:  { userId_email: { userId, email: info.email } },
      update: {
        accessToken: tokenData.access_token,
        ...(tokenData.refresh_token && { refreshToken: tokenData.refresh_token }),
        expiresAt,
      },
      create: {
        userId,
        email:        info.email,
        provider:     "google",
        accessToken:  tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt,
      },
    });

    res.redirect(`${FRONTEND_URL}/settings?gmail_connected=${encodeURIComponent(info.email)}`);
  } catch (err) {
    console.error("[auth/google/gmail/callback]", err);
    res.redirect(`${FRONTEND_URL}/settings?gmail_error=error`);
  }
});

// GET /api/auth/google — inicia el flujo OAuth
authRouter.get("/google", (_req: Request, res: Response) => {
  if (!GOOGLE_CLIENT_ID) {
    res.status(501).json({ error: "Google OAuth not configured" });
    return;
  }
  const params = new URLSearchParams({
    client_id:     GOOGLE_CLIENT_ID,
    redirect_uri:  GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope:         "openid email profile",
    access_type:   "offline",
    prompt:        "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// GET /api/auth/google/callback — Google redirige acá con el code
authRouter.get("/google/callback", async (req: Request, res: Response) => {
  const { code, error } = req.query as { code?: string; error?: string };

  if (error || !code) {
    res.redirect(`${FRONTEND_URL}/login?error=google_cancelado`);
    return;
  }

  try {
    // Intercambiar code por access_token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri:  GOOGLE_REDIRECT_URI,
        grant_type:    "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json() as { access_token?: string };

    if (!tokenData.access_token) {
      res.redirect(`${FRONTEND_URL}/login?error=google_token`);
      return;
    }

    // Obtener perfil del usuario
    const infoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const info = await infoRes.json() as { email?: string; name?: string; id?: string };

    if (!info.email) {
      res.redirect(`${FRONTEND_URL}/login?error=google_sin_email`);
      return;
    }

    const googleEmail = info.email.trim().toLowerCase();

    // Buscar o crear usuario (misma normalización de email que registro clásico)
    let user = await prisma.user.findFirst({
      where: { email: { equals: googleEmail, mode: "insensitive" } },
    });
    if (!user) {
      const hash = await bcrypt.hash(info.id ?? googleEmail, 12);
      user = await prisma.user.create({
        data: {
          email:   googleEmail,
          name:    info.name ?? googleEmail.split("@")[0],
          password: hash,
          status:  "active",
          isAdmin: false,
        },
      });
      await prisma.userSettings.create({ data: { userId: user.id } });
    }

    const status = (user as { status?: string }).status;
    if (status === "blocked") {
      res.redirect(`${FRONTEND_URL}/login?error=cuenta_bloqueada`);
      return;
    }

    const accessToken = createAccessToken(user.id);
    const refreshRaw  = await createRefreshTokenRecord(user.id, req);
    res.cookie(REFRESH_COOKIE, refreshRaw, refreshCookieOptions());
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${encodeURIComponent(accessToken)}`);
  } catch (err) {
    console.error("[auth/google/callback]", err);
    res.redirect(`${FRONTEND_URL}/login?error=google_error`);
  }
});

// POST /api/auth/refresh — emite access nuevo usando cookie de refresh
authRouter.post("/refresh", async (req: Request, res: Response) => {
  const raw   = readRefreshFromCookie(req);
  const userId = await validateRefreshValue(raw);
  if (!userId) {
    res.status(401).json({ error: "Sesión expirada. Iniciá sesión de nuevo.", code: "REFRESH_INVALID" });
    return;
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(401).json({ error: "Usuario no encontrado", code: "USER_GONE" });
      return;
    }
    if ((user as { status?: string }).status === "blocked") {
      res.status(403).json({ error: "Account blocked" });
      return;
    }
    res.json({ token: createAccessToken(user.id), user: sessionUserFromDb(user) });
  } catch (err) {
    console.error("[auth/refresh]", err);
    res.status(500).json({ error: "Error al renovar la sesión" });
  }
});

// POST /api/auth/logout — revoca refresh y borra cookie
authRouter.post("/logout", async (req: Request, res: Response) => {
  const raw = readRefreshFromCookie(req);
  await revokeRefreshValue(raw);
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: 0 });
  res.json({ ok: true });
});

// POST /api/auth/forgot-password
authRouter.post("/forgot-password", async (req: Request, res: Response) => {
  const { email } = (req.body ?? {}) as { email?: string };
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Indicá un email" });
    return;
  }
  const emailNorm = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    res.status(400).json({ error: "Formato de email inválido" });
    return;
  }
  try {
    const outcome = await requestPasswordReset(emailNorm);
    res.json({ outcome });
  } catch (err) {
    console.error("[auth/forgot-password]", err);
    res.status(500).json({ error: "Error al procesar el pedido" });
  }
});

// POST /api/auth/reset-password
authRouter.post("/reset-password", async (req: Request, res: Response) => {
  const { token, password } = (req.body ?? {}) as { token?: string; password?: string };
  if (!token || typeof token !== "string" || !password) {
    res.status(400).json({ error: "Token y contraseña son obligatorios" });
    return;
  }
  const result = await resetPasswordWithToken(token, password);
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ ok: true, message: "Contraseña actualizada. Podés iniciar sesión con la nueva clave." });
});

// POST /api/auth/send-verification-email — requiere Bearer; genera 6 dígitos y envía por Resend
authRouter.post("/send-verification-email", async (req: Request, res: Response) => {
  const userId = getUserIdFromAccessToken(req);
  if (!userId) {
    res.status(401).json({ error: "Necesitás iniciar sesión" });
    return;
  }
  try {
    const r = await sendEmailVerification(userId);
    if (r === "no_user") { res.status(404).json({ error: "Usuario no encontrado" }); return; }
    if (r === "already") { res.json({ ok: true, outcome: "already" }); return; }
    if (r === "unconfigured") { res.json({ ok: true, outcome: "unconfigured" }); return; }
    if (r === "send_failed") { res.json({ ok: false, outcome: "send_failed" }); return; }
    res.json({ ok: true, outcome: "sent" });
  } catch (err) {
    console.error("[auth/send-verification-email]", err);
    res.status(500).json({ error: "Error al enviar el correo" });
  }
});

// POST /api/auth/verify-email-code — requiere Bearer; body: { "code": "123456" }
authRouter.post("/verify-email-code", async (req: Request, res: Response) => {
  const userId = getUserIdFromAccessToken(req);
  if (!userId) {
    res.status(401).json({ error: "Necesitás iniciar sesión" });
    return;
  }
  const { code } = (req.body ?? {}) as { code?: string };
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Indicá el código de 6 dígitos" });
    return;
  }
  const r = await confirmEmailCode(userId, code);
  if (r === "bad_code") { res.status(400).json({ error: "Código incorrecto" }); return; }
  if (r === "expired") { res.status(400).json({ error: "Código vencido. Pedí uno nuevo." }); return; }
  if (r === "already") { res.json({ ok: true, already: true }); return; }
  if (r === "no_user") { res.status(404).json({ error: "Usuario no encontrado" }); return; }
  res.json({ ok: true });
});

// POST /api/auth/delete-account — Bearer; body: { "emailConfirm": "tu@email.com" } (debe coincidir con el usuario)
authRouter.post("/delete-account", async (req: Request, res: Response) => {
  const userId = getUserIdFromAccessToken(req);
  if (!userId) {
    res.status(401).json({ error: "Necesitás iniciar sesión" });
    return;
  }
  if (userId === "default-user") {
    res.status(403).json({ error: "Esta cuenta no se puede eliminar" });
    return;
  }
  const { emailConfirm } = (req.body ?? {}) as { emailConfirm?: string };
  const ev = (emailConfirm ?? "").trim().toLowerCase();
  if (!ev) {
    res.status(400).json({ error: "Escribí tu email para confirmar" });
    return;
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }
    if (user.isAdmin) {
      res.status(403).json({ error: "Las cuentas de administrador no se pueden eliminar desde la app" });
      return;
    }
    if (user.email.toLowerCase() !== ev) {
      res.status(400).json({ error: "El email no coincide con tu cuenta" });
      return;
    }
    await deleteAllUserData(userId);
    res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: 0 });
    res.json({ ok: true, message: "Cuenta eliminada" });
  } catch (err) {
    console.error("[auth/delete-account]", err);
    res.status(500).json({ error: "No se pudo eliminar la cuenta" });
  }
});

// GET /api/auth/me
authRouter.get("/me", async (req: Request, res: Response) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const jwt = await import("jsonwebtoken");
    const token = header.slice(7);
    const payload = jwt.default.verify(token, process.env.JWT_SECRET ?? "coach-financiero-dev-secret") as { userId: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true, isAdmin: true, status: true, emailVerifiedAt: true },
    });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json({
      ...user,
      emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
    });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});
