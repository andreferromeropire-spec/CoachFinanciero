import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "@coach/db";
import { createToken } from "../middleware/auth";

export const authRouter = Router();

// POST /api/auth/login
authRouter.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

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

  const token = createToken(user.id);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin } });
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
      select: { id: true, email: true, name: true, isAdmin: true },
    });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json(user);
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});
