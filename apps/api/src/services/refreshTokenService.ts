import { createHash, randomBytes } from "node:crypto";
import type { Request } from "express";
import { prisma } from "@coach/db";

const REFRESH_DAYS = 30;

function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export const REFRESH_COOKIE = "coach_rt";

export function generateRefreshValue(): string {
  return randomBytes(32).toString("base64url");
}

export function clientMeta(req: Request): { userAgent: string | null; ip: string | null } {
  const userAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null;
  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() ?? null : (req.socket?.remoteAddress ?? null);
  return { userAgent, ip };
}

/**
 * Crea registro de refresh y devuelve el valor en claro (sólo para Set-Cookie).
 */
export async function createRefreshTokenRecord(
  userId: string,
  req: Request,
): Promise<string> {
  const raw = generateRefreshValue();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
  const { userAgent, ip } = clientMeta(req);
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      userAgent: userAgent ?? undefined,
      ip: ip ?? undefined,
    },
  });
  return raw;
}

/**
 * Resuelve userId desde el valor en claro del refresh, o null.
 */
export async function validateRefreshValue(raw: string | undefined): Promise<string | null> {
  if (!raw || !raw.length) return null;
  const tokenHash = hashToken(raw);
  const row = await prisma.refreshToken.findFirst({
    where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
  });
  if (!row) return null;
  return row.userId;
}

export async function revokeRefreshValue(raw: string | undefined): Promise<void> {
  if (!raw || !raw.length) return;
  const tokenHash = hashToken(raw);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllForUser(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function readRefreshFromCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === REFRESH_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}
