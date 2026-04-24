import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "coach-financiero-dev-secret";
const DEFAULT_USER_ID = "default-user";

export interface AuthRequest extends Request {
  userId: string;
}

/**
 * Access JWT corto (15m). El refresh vive en cookie httpOnly (ver /api/auth/refresh).
 */
export function createAccessToken(userId: string): string {
  return jwt.sign({ userId, typ: "access" }, JWT_SECRET, { expiresIn: "15m" });
}

/** @deprecated Usar createAccessToken */
export function createToken(userId: string): string {
  return createAccessToken(userId);
}

/**
 * - Sin `Authorization`: compat single-user (default-user).
 * - Con Bearer inválido o vencido: 401 (el front debe llamar POST /api/auth/refresh).
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthRequest;

  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const token = header.slice(7);
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
      authReq.userId = payload.userId;
    } catch {
      res.status(401).json({ error: "Token inválido o expirado", code: "ACCESS_EXPIRED" });
      return;
    }
  } else {
    authReq.userId = DEFAULT_USER_ID;
  }

  next();
}

/**
 * UserId del access JWT (header Authorization). No confundir con `authMiddleware` (default-user).
 * Para rutas bajo `/api/auth` que requieren sesión real.
 */
export function getUserIdFromAccessToken(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try {
    const p = jwt.verify(h.slice(7), JWT_SECRET) as { userId: string };
    return p.userId ?? null;
  } catch {
    return null;
  }
}
