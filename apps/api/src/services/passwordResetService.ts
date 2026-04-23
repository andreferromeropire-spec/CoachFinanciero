import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@coach/db";
import { revokeAllForUser } from "./refreshTokenService";

const RESET_TTL_MS = 60 * 60 * 1000;

const RESEND_KEY  = (process.env.RESEND_API_KEY ?? "").trim();
const RESEND_FROM = (process.env.RESEND_FROM ?? "Coach Financiero <onboarding@resend.dev>").trim();
const WEB_BASE    = (process.env.PUBLIC_WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Sin SDK (evita requerir Node 20+ en el deploy); API https://resend.com/docs */
async function enviarMailResend(to: string, subject: string, html: string): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      from:    RESEND_FROM,
      to:      [to],
      subject,
      html,
    }),
  });
  const bodyText = await res.text();
  if (!res.ok) {
    console.error("[passwordReset] Resend error HTTP", res.status, bodyText);
    return false;
  }
  try {
    const j = JSON.parse(bodyText) as { id?: string };
    console.log("[passwordReset] Resend aceptó el envío, id:", j.id ?? bodyText);
  } catch {
    console.log("[passwordReset] Resend aceptó el envío (respuesta no JSON):", bodyText.slice(0, 200));
  }
  return true;
}

export type RequestPasswordResetOutcome =
  | "email_sent"
  | "not_registered"
  | "account_blocked"
  | "send_failed"
  | "resend_unconfigured";

export function hashPasswordResetValue(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function generatePasswordResetValue(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Crea/actualiza token (hash) e intenta enviar mail con Resend, o deja trazas en consola (sin clave).
 */
export async function requestPasswordReset(
  emailNormalizado: string,
): Promise<RequestPasswordResetOutcome> {
  const email = emailNormalizado.trim().toLowerCase();
  if (!email) return "not_registered";

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (!user) {
    console.log("[passwordReset] ningún usuario con ese email");
    return "not_registered";
  }

  if ((user as { status?: string }).status === "blocked") {
    console.log("[passwordReset] usuario bloqueado, no se envía mail");
    return "account_blocked";
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

  if (RESEND_KEY) {
    const html = `
        <p>Hola${user.name ? `, ${user.name}` : ""},</p>
        <p>Alguien pidió restablecer la contraseña de tu cuenta. Si fuiste vos, hacé clic en el enlace (válido 1 hora):</p>
        <p><a href="${link}">Restablecer contraseña</a></p>
        <p>Si no pediste el cambio, podés ignorar este correo. Tu clave no se modifica mientras no uses el enlace.</p>
    `.trim();
    const target = (user.email ?? email).trim();
    const ok = await enviarMailResend(target, subject, html);
    if (!ok) {
      console.error("[passwordReset] falló el envío; revisá RESEND_API_KEY, RESEND_FROM (dominio verificado) y logs de Resend arriba");
      return "send_failed";
    }
    return "email_sent";
  }

  console.log("[passwordReset] RESEND_API_KEY no configurada — enlace (solo desarrollo):", link);
  return "resend_unconfigured";
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
