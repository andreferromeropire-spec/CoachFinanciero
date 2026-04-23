import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Resend } from "resend";
import { prisma } from "@coach/db";
import { revokeAllForUser } from "./refreshTokenService";

const RESET_TTL_MS = 60 * 60 * 1000;

const RESEND_KEY = (process.env.RESEND_API_KEY ?? "").trim();
const RESEND_FROM = (process.env.RESEND_FROM ?? "Coach Financiero <onboarding@resend.dev>").trim();
const WEB_BASE = (process.env.PUBLIC_WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");

const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;

export function hashPasswordResetValue(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function generatePasswordResetValue(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Crea/actualiza token (hash) y, si Resend está configurado, manda el mail. Si no, loguea el enlace en consola.
 */
export async function requestPasswordReset(emailNormalizado: string): Promise<void> {
  const email = emailNormalizado.trim().toLowerCase();
  if (!email) return;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;

  if ((user as { status?: string }).status === "blocked") {
    return;
  }

  const raw = generatePasswordResetValue();
  const tokenHash = hashPasswordResetValue(raw);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken:  tokenHash,
      passwordResetExpiry: expiresAt,
    },
  });

  const link = `${WEB_BASE}/reset-password?token=${encodeURIComponent(raw)}`;
  const subject = "Cambiá tu contraseña — Coach Financiero";

  if (resend) {
    const { error } = await resend.emails.send({
      from:    RESEND_FROM,
      to:      email,
      subject,
      html: `
        <p>Hola${user.name ? `, ${user.name}` : ""},</p>
        <p>Alguien pidió restablecer la contraseña de tu cuenta. Si fuiste vos, hacé clic en el enlace (válido 1 hora):</p>
        <p><a href="${link}">Restablecer contraseña</a></p>
        <p>Si no pediste el cambio, podés ignorar este correo. Tu clave no se modifica mientras no uses el enlace.</p>
      `.trim(),
    });
    if (error) {
      console.error("[passwordReset] Resend", error);
    }
  } else {
    console.log("[passwordReset] RESEND_API_KEY no configurada — enlace (solo desarrollo):", link);
  }
}

export async function resetPasswordWithToken(
  rawToken: string,
  newPassword: string,
): Promise<{ ok: true } | { error: string }> {
  const t = (rawToken ?? "").trim();
  if (!t || t.length < 20) {
    return { error: "El enlace no es válido. Pedí uno nuevo." };
  }
  if (newPassword.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const tokenHash = hashPasswordResetValue(t);
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken:  tokenHash,
      passwordResetExpiry: { gt: new Date() },
    },
  });

  if (!user) {
    return { error: "El enlace expiró o ya se usó. Volvé a pedir un correo de recuperación." };
  }

  const passHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password:            passHash,
      passwordResetToken:  null,
      passwordResetExpiry: null,
    },
  });
  await revokeAllForUser(user.id);

  return { ok: true };
}
