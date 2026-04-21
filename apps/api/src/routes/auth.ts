import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "@coach/db";
import { createToken } from "../middleware/auth";

export const authRouter = Router();

const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const GOOGLE_REDIRECT_URI  = process.env.GOOGLE_REDIRECT_URI  ?? "http://localhost:4000/api/auth/google/callback";
const FRONTEND_URL         = process.env.PUBLIC_WEB_URL       ?? "http://localhost:3000";

// POST /api/auth/login
authRouter.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
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

    const token = createToken(user.id);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin } });
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

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: "Invalid email format" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const hash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { name, email, password: hash, status: "active" },
    });

    await prisma.userSettings.create({ data: { userId: user.id } });

    const token = createToken(user.id);
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin } });
  } catch (err) {
    console.error("[auth/register]", err);
    res.status(500).json({ error: "Server error, please try again" });
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

    // Buscar o crear usuario
    let user = await prisma.user.findUnique({ where: { email: info.email } });
    if (!user) {
      const hash = await bcrypt.hash(info.id ?? info.email, 12);
      user = await prisma.user.create({
        data: {
          email:   info.email,
          name:    info.name ?? info.email.split("@")[0],
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

    const token = createToken(user.id);
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error("[auth/google/callback]", err);
    res.redirect(`${FRONTEND_URL}/login?error=google_error`);
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
      select: { id: true, email: true, name: true, isAdmin: true, status: true },
    });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json(user);
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});
