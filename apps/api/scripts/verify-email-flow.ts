/**
 * Smoke: flujo de verificación de email (registro → enviar código → confirmar 6 dígitos).
 * Requiere el API levantado y, para el paso del código, acceso a la misma DB que el API
 * (lee el hash de `User.emailVerifyCodeHash` y prueba 000000–999999 en memoria, sin 1M requests HTTP).
 *
 *   cd apps/api && npm run dev
 *   otra terminal:
 *   cd apps/api && npx tsx scripts/verify-email-flow.ts
 *
 * Variables: API_BASE (default http://localhost:4000), DATABASE_URL (misma que el API, en .env).
 * No usar contra producción salvo que sepas qué hacés (set ALLOW_PROD_SMOKE=1 y API_BASE=...).
 */

import "dotenv/config";
import { createHash } from "node:crypto";
import { prisma } from "@coach/db";

const base = (process.env.API_BASE ?? "http://localhost:4000").replace(/\/$/, "");
const isLocal = /localhost|127\.0\.0\.1/.test(base);
if (!isLocal && !process.env.ALLOW_PROD_SMOKE) {
  console.error("Usa API_BASE con localhost, o ALLOW_PROD_SMOKE=1 con cuidado.\n");
  process.exit(1);
}

function hashCode(userId: string, code: string) {
  return createHash("sha256").update(`${userId}:email:${code}`, "utf8").digest("hex");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const email = `smoke_${Date.now()}@test.coachfin.local`;
  const pass  = "SmokeTest1!";
  const name  = "Smoke";

  console.log("[smoke:email] 1) Registro", email);
  const reg = await fetch(`${base}/api/auth/register`, {
    method:  "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ name, email, password: pass }),
  });
  const regJ = (await reg.json().catch(() => ({}))) as { token?: string; error?: string; user?: { emailVerifiedAt?: string | null } };
  if (!reg.ok || !regJ.token) {
    console.error("Registro falló", reg.status, regJ);
    process.exit(1);
  }
  if (regJ.user?.emailVerifiedAt) {
    console.error("Esperábamos email aún no verificado");
    process.exit(1);
  }
  const token = regJ.token;

  await sleep(200);

  console.log("[smoke:email] 2) Reenviar código (POST /api/auth/send-verification-email)");
  const send = await fetch(`${base}/api/auth/send-verification-email`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const sendJ = (await send.json().catch(() => ({}))) as { ok?: boolean; outcome?: string };
  if (!send.ok) {
    console.error("Enviar código falló", send.status, sendJ);
    process.exit(1);
  }
  console.log("  respuesta outcome:", sendJ.outcome);

  if (!process.env.DATABASE_URL) {
    console.log(
      "\n[smoke:email] Sin DATABASE_URL: no se puede adivinar el código aquí. " +
        "Definí DATABASE_URL en .env (misma conexión que el API) y reejecutá, " +
        "o verificá a mano con el mail / log del API.\n",
    );
    process.exit(0);
  }

  const u = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, emailVerifyCodeHash: true, emailVerifyExpires: true },
  });
  if (!u?.emailVerifyCodeHash) {
    console.error("No hay hash de código en DB; ¿migró la tabla User?");
    process.exit(1);
  }
  if (u.emailVerifyExpires && u.emailVerifyExpires < new Date()) {
    console.error("Código vencido");
    process.exit(1);
  }

  let code: string | null = null;
  for (let i = 0; i < 1_000_000; i += 1) {
    const c         = String(i).padStart(6, "0");
    if (hashCode(u.id, c) === u.emailVerifyCodeHash) {
      code = c;
      break;
    }
  }
  if (!code) {
    console.error("No se encontró código (hash en DB no coincide; bug o otro algoritmo).");
    process.exit(1);
  }
  console.log("[smoke:email] 3) Código resuelto localmente, POST /api/auth/verify-email-code");

  const v = await fetch(`${base}/api/auth/verify-email-code`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    JSON.stringify({ code }),
  });
  const vJ = (await v.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!v.ok) {
    console.error("Verificación falló", v.status, vJ);
    process.exit(1);
  }
  console.log("  OK", vJ);
  const again = await prisma.user.findUnique({
    where: { id: u.id },
    select: { emailVerifiedAt: true },
  });
  if (!again?.emailVerifiedAt) {
    console.error("emailVerifiedAt debería estar seteado");
    process.exit(1);
  }
  console.log("[smoke:email] ✓ Listo. Usuario de prueba:", email, "— podés borrarlo de la DB si querés.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
