import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "coach-financiero-dev-secret";
const DEFAULT_USER_ID = "default-user";

export interface AuthRequest extends Request {
  userId: string;
}

/**
 * Middleware de autenticación.
 * - Si hay un JWT válido en Authorization: Bearer <token>, usa ese userId.
 * - Si no hay header, usa "default-user" para mantener compatibilidad
 *   con la instalación single-user mientras no se implemente el login.
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const authReq = req as AuthRequest;

  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const token = header.slice(7);
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
      authReq.userId = payload.userId;
    } catch {
      authReq.userId = DEFAULT_USER_ID;
    }
  } else {
    authReq.userId = DEFAULT_USER_ID;
  }

  next();
}

export function createToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "30d" });
}
