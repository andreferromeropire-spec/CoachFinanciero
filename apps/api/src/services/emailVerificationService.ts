import { createHash, randomInt } from "node:crypto";
import { prisma } from "@coach/db";

const VERIFY_TTL_MS = 10 * 60 * 1000;

const RESEND_KEY  = (process.env.RESEND_API_KEY ?? "").trim();
const RESEND_FROM = (process.env.RESEND_FROM ?? "Coach Financiero <onboarding@resend.dev>").trim();
const WEB_BASE    = (process.env.PUBLIC_WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");

function hashCode(userId: string, code: string): string {
  return createHash("sha256").update(`${userId}:email:${code}`, "utf8").digest("hex");
}

function generar6Digitos(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

async function enviarResend(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_KEY) {
    console.warn("[emailVerify] sin RESEND_API_KEY");
    return false;
  }
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
  const text = await res.text();
  if (!res.ok) {
    console.error("[emailVerify] Resend", res.status, text);
    return false;
  }
  try {
    const j = JSON.parse(text) as { id?: string };
    console.log("[emailVerify] Resend id:", j.id);
  } catch {
    /* ok */
  }
  return true;
}

export type SendEmailVerificationResult =
  | "sent"
  | "already"
  | "no_user"
  | "send_failed"
  | "unconfigured";

export async function sendEmailVerification(userId: string): Promise<SendEmailVerificationResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return "no_user";
  if (user.emailVerifiedAt) return "already";

  const code  = generar6Digitos();
  const h     = hashCode(userId, code);
  const until = new Date(Date.now() + VERIFY_TTL_MS);
  const email = user.email;

  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerifyCodeHash:  h,
      emailVerifyExpires:     until,
    },
  });

  if (!RESEND_KEY) {
    console.log("[emailVerify] (dev) código sin Resend — usuario", userId, "código", code);
    return "unconfigured";
  }

  const subject = "Verificá tu email — Coach Financiero";
  const html    = `
    <p>Hola${user.name ? `, ${user.name}` : ""},</p>
    <p>Tu código de verificación (válido 10 minutos) es:</p>
    <p style="font-size:24px;font-weight:bold;letter-spacing:0.1em;">${code}</p>
    <p>O abrí la app en <a href="${WEB_BASE}/verify-email">verificar email</a> e ingresalo allí.</p>
  `.trim();
  const ok = await enviarResend(email, subject, html);
  return ok ? "sent" : "send_failed";
}

export type ConfirmEmailCodeResult = "ok" | "no_user" | "bad_code" | "expired" | "already";

export async function confirmEmailCode(userId: string, codeRaw: string): Promise<ConfirmEmailCodeResult> {
  const code = (codeRaw ?? "").replace(/\D/g, "").trim();
  if (code.length !== 6) return "bad_code";

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return "no_user";
  if (user.emailVerifiedAt) return "already";
  if (!user.emailVerifyExpires || !user.emailVerifyCodeHash) {
    return "expired";
  }
  if (user.emailVerifyExpires < new Date()) {
    return "expired";
  }
  if (user.emailVerifyCodeHash !== hashCode(userId, code)) {
    return "bad_code";
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerifiedAt:     new Date(),
      emailVerifyCodeHash:  null,
      emailVerifyExpires:  null,
    },
  });
  return "ok";
}
