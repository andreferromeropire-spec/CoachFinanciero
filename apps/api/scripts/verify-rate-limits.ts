/**
 * Smoke: Helmet + rate limit (auth / global / coach opcional).
 * API en marcha: por defecto http://localhost:4000
 *
 *   cd apps/api
 *   npx tsx scripts/verify-rate-limits.ts
 *   npx tsx scripts/verify-rate-limits.ts --global
 *   npx tsx scripts/verify-rate-limits.ts --all
 *   npx tsx scripts/verify-rate-limits.ts --all --coach
 *
 * --all = Helmet + auth + global (el global usa RateLimit-Remaining, sin adivinar “basura” previa)
 * Sólo localhost salvo ALLOW_PROD_SMOKE=1
 */

const base = (process.env.API_BASE ?? "http://localhost:4000").replace(/\/$/, "");

if (!/localhost|127\.0\.0\.1/.test(base) && !process.env.ALLOW_PROD_SMOKE) {
  console.error(
    "\n[verify-rate-limits] Usa API_BASE con localhost o 127.0.0.1, o set ALLOW_PROD_SMOKE=1.\n",
  );
  process.exit(1);
}

const a = new Set(process.argv.slice(2));

if (a.has("-h") || a.has("--help")) {
  console.log(`
Npx tsx scripts/verify-rate-limits.ts  [ --global ]  [ --coach ]  [ --all ]

  (nada)    Helmet + límite /api/auth (10/min)
  --global  Sólo global: 201× GET /api/health (API en frío o se combina con --all)
  --coach   22 POST /api/coach (cuidado: puede llamar a IA; busca 429)
  --all     Helmet + auth + global (lee el header del limiter) [+ --coach]
\n`);
  process.exit(0);
}

function fetchB(path: string, init?: RequestInit) {
  return fetch(path.startsWith("http") ? path : `${base}${path}`, { ...init } as RequestInit);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function checkHelmetHeaders(r: Response) {
  const n = r.headers.get("x-content-type-options");
  if (!n || n.toLowerCase() !== "nosniff") {
    throw new Error(
      `Helmet: esperaba x-content-type-options: nosniff, tengo: ${n ?? "vacío"}`,
    );
  }
}

async function testHelmet() {
  const r = await fetchB("/api/health", { method: "GET" });
  checkHelmetHeaders(r);
  console.log("  OK Helmet (X-Content-Type-Options: nosniff en /api/health)");
}

async function testAuthLimiter() {
  const body = JSON.stringify({ email: "smoke@local.invalid", password: "wrong00000" });
  const headers = { "Content-Type": "application/json" };
  let c429 = 0;
  for (let i = 0; i < 12; i++) {
    const r = await fetchB("/api/auth/login", { method: "POST", headers, body });
    if (r.status === 429) c429 += 1;
  }
  if (c429 < 1) throw new Error("auth: esperaba al menos un 429 en 12 logins de prueba");
  console.log(`  OK límite /api/auth (429×${c429} en 12 posts)`);
}

/** express-rate-limit: draft-6 (RateLimit-*) o legado (X-RateLimit-*) */
function readRateLimitRemaining(r: Response): number | null {
  const pick = (name: string) => {
    const v = r.headers.get(name);
    if (v == null) return null;
    const n = parseInt(String(v).trim(), 10);
    return Number.isNaN(n) ? null : n;
  };
  return (
    pick("RateLimit-Remaining") ??
    pick("X-RateLimit-Remaining")
  );
}

/**
 * GET /api/health usado como probe al limiter global. Tras un smoke:limits:all justo
 * antes, la misma ventana 1 min puede seguir llena (429) — repetimos luego de 65s.
 */
async function fetchGlobalProbe(where: string, maxWaits: number) {
  for (let w = 0; w <= maxWaits; w++) {
    const r = await fetchB("/api/health", { method: "GET" });
    if (r.status === 200) {
      if (w > 0) {
        console.log(`  (global) [${where}] /api/health 200 luego de espera — sigo\n`);
      }
      return r;
    }
    if (r.status === 429) {
      if (w < maxWaits) {
        console.log(
          `  (global) [${where}] /api/health = 429 (misma ventana 1 min que otra prueba). Espero 65s…\n`,
        );
        await sleep(65_000);
        continue;
      }
      throw new Error(
        `global [${where}]: /api/health sigue 429. Reiniciá "npm run dev" o dejá pasar 1 min.`,
      );
    }
    throw new Error(`global [${where}]: probe /api/health inesperado, tengo ${r.status}`);
  }
}

/**
 * Un GET /api/health ya ocurrió; el header dice cuántas peticiones quedan en la ventana
 * (tras esta respuesta) antes de 429. Hacemos esas `rem` con 200 y el siguiente 429.
 */
async function testGlobalFromProbeResponse(probe: Response, where: string) {
  if (probe.status !== 200) {
    throw new Error(`global [${where}]: probe /api/health esperaba 200, tengo ${probe.status}`);
  }
  const rem = readRateLimitRemaining(probe);
  if (rem == null) {
    throw new Error(
      `global [${where}]: no encontré RateLimit-Remaining (revisá express-rate-limit)`,
    );
  }
  console.log(`  (global) quedan ${rem} en la ventana (header) — completando hasta 429\n`);
  for (let i = 0; i < rem; i++) {
    const r = await fetchB("/api/health", { method: "GET" });
    if (r.status !== 200) {
      throw new Error(
        `global [${where}]: ${i + 1}/${rem} GET esperaba 200, tengo ${r.status}`,
      );
    }
  }
  const rLast = await fetchB("/api/health", { method: "GET" });
  if (rLast.status !== 429) {
    throw new Error(`global [${where}]: luego de ${rem} ok esperaba 429, tengo ${rLast.status}`);
  }
  console.log(`  OK límite global 200/min (1 probe + ${rem}×200 + 1×429)\n`);
}

async function testCoachLimiter() {
  const body = JSON.stringify({
    message: "ping",
    conversationId: "smoke",
    conversationHistory: [],
  });
  const headers = { "Content-Type": "application/json" } as const;
  let c429 = 0;
  for (let j = 0; j < 22; j++) {
    const r = await fetchB("/api/coach/message", { method: "POST", headers, body });
    if (r.status === 429) c429 += 1;
  }
  if (c429 < 1) {
    throw new Error("coach: esperaba al menos un 429 (límite 20/min)");
  }
  console.log(`  OK límite /api/coach (429 visto ${c429} veces en 22 posts)`);
}

async function main() {
  const withGlobal = a.has("--global");
  const withCoach  = a.has("--coach");
  const all         = a.has("--all");

  console.log(`\n[verify-rate-limits] API_BASE=${base}\n`);

  if (all) {
    await testHelmet();
    await testAuthLimiter();
    const probe = await fetchGlobalProbe("--all", 3);
    checkHelmetHeaders(probe);
    await testGlobalFromProbeResponse(probe, "--all");
    if (withCoach) await testCoachLimiter();
    console.log("\n[verify-rate-limits] Listo (--all)\n");
    return;
  }

  if (withGlobal) {
    const r0 = await fetchGlobalProbe("--global", 3);
    checkHelmetHeaders(r0);
    console.log("  OK Helmet (X-Content-Type-Options: nosniff en /api/health)\n");
    await testGlobalFromProbeResponse(r0, "--global");
  } else {
    await testHelmet();
    await testAuthLimiter();
  }

  if (withCoach && !all) {
    console.log("  (coach) 22 requests — puede ser lento o fallar 5xx si el coach llama a IA\n");
    await testCoachLimiter();
  }

  if (withGlobal && !all) {
    console.log(
      "\n[verify-rate-limits] Listo (Helmet + global). Tip: con --all podés mezclar con auth en el mismo minuto lógico.\n",
    );
  } else {
    console.log(
      "\n[verify-rate-limits] Listo. Para global: npx tsx scripts/verify-rate-limits.ts --global (API recién levantada) o --all\n",
    );
  }
}

main().catch((e) => {
  console.error("\n[verify-rate-limits] FAIL:", e?.message ?? e, "\n");
  process.exit(1);
});
