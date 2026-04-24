# NEXT_STEPS

## MVP — alineado a `masterplan.md` §6 (Fase 1)

`masterplan.md` es la fuente de verdad del orden; los ítems 1–15 de **Fase 1** son el MVP personal.

| # | Ítem (resumen) | Estado |
|---|----------------|--------|
| 1 | **Sesión persistente** — `RefreshToken` en DB, access 15m, refresh en cookie `coach_rt` (httpOnly, `SameSite=none` + `secure` en prod, `lax` en dev), `POST /api/auth/refresh`, `POST /api/auth/logout`, web con `credentials: "include"` + refresh en 401 | hecho (ver SQL manual abajo si no usás `migrate deploy`) |
| 2 | **Helmet + rate limiting** — `helmet()`, `trust proxy`, límites: auth 10/min, coach 20/min, ingest 50/h, global 200/min | hecho |
| 3 | **Reset de contraseña** — `passwordResetToken` (hash) + `passwordResetExpiry` 1h, Resend, `POST /forgot-password`, `POST /reset-password`, web `/forgot-password` y `/reset-password` | **hecho** (prod: `RESEND_API_KEY` + variable correcta `RESEND_FROM` en el servicio del API, no `SEND_FROM`) |
| 4 | **Verificación de email** — 6 dígitos, 10 min, `emailVerifiedAt` + Resend, `POST` send/verify, `/verify-email` | hecho en código; en prod: `prisma migrate deploy` (`20260425120000_email_verification`) y probar flujo |
| 5 | **Toasts + Error boundary** | pendiente |
| 6 | **formatMoney / formatDate** centralizados | pendiente |
| 7+ | `isInternalTransfer` / `isIgnored`, `ExchangeRate`, `LearnedRule`, matches, etc. (ver plan) | pendiente |

### Cómo probar Helmet + rate limit (automático)

Con el API levantado en `localhost:4000`:

```bash
cd apps/api
npm run smoke:limits
npm run smoke:limits:all
```

- `smoke:limits` — comprobaciones rápidas (Helmet + límite `/api/auth`, ~12 requests).
- `smoke:limits:all` — además de lo anterior, prueba el límite global (cuenta 1+12 peticiones anteriores + el resto hasta 429; ~200+ `GET` a `/api/health`). Tras probar con `smoke:limits` es mejor **reiniciar** `npm run dev` o esperar 1 minuto para que el contador baje. Opción con IA: `npx tsx scripts/verify-rate-limits.ts --all --coach` (cuidado con crédito Anthropic).

Otra consola, antes: `cd apps/api && npm run dev`.

### Cómo probar verificación de email (smoke + manual)

**Automático (misma idea que `smoke:limits`):** con el API en `localhost:4000` y `DATABASE_URL` en `apps/api/.env` (misma base que usa el API al registrarse):

```bash
cd apps/api
npm run smoke:email
```

El script: crea un usuario de prueba, pide un código, **calcula el código a partir del hash en la DB** (no requiere leer el mail) y llama a `POST /api/auth/verify-email-code`. Si no tenés `DATABASE_URL` en el entorno del script, solo hace registro + enviar y te indica probar a mano.

**Manual (flujo real):** migración aplicada en la DB → registro o login con cuenta **sin** `emailVerifiedAt` → debería llevarte a `/verify-email` o abrí esa ruta con sesión iniciada → Revisá el mail (o en local sin Resend, a veces el código va al log del API) → ingresá los 6 números → debería marcar verificado y redirigir al inicio. Con Google, tras el callback, si el mail no está verificado te manda a la misma pantalla.

### Acción inmediata

- [x] Reset de contraseña y `RESEND_FROM` correcto (no `SEND_FROM`) en el API.
- [x] **Verificación de email** en código: migración `20260425120000`, rutas, `/verify-email`, registro/ login/Google devuelven `emailVerifiedAt`.
- [ ] En Railway: `migrate deploy` (o SQL manual de arriba) + probar email + código. Luego: **toasts** (ítem 5) y `formatMoney` (ítem 6).

### SQL manual en Railway (columnas reset de contraseña, ítem 3)

Solo si no corrés `prisma migrate deploy` y faltan columnas en `User`:

```sql
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordResetToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordResetExpiry" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "User_passwordResetToken_idx" ON "User"("passwordResetToken");
```

Luego: `npx prisma migrate resolve --applied 20260424120000_password_reset` (en `packages/db` con `DATABASE_URL` de Railway).

### SQL manual en Railway (verificación de email, ítem 4)

Solo si no aplica `migrate deploy` y faltan columnas:

```sql
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifyCodeHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifyExpires" TIMESTAMP(3);
```

Luego, si aplica: `npx prisma migrate resolve --applied 20260425120000_email_verification` (en `packages/db`).

### SQL manual en Railway (tabla `RefreshToken`)

Si no usás `npx prisma migrate deploy` y preferís el **Query** de la base en Railway, pegá esto (solo si la tabla **no** existe):

```sql
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");
CREATE INDEX "RefreshToken_tokenHash_idx" ON "RefreshToken"("tokenHash");
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Luego, desde tu máquina (con `DATABASE_URL` de Railway y estando en `packages/db`):

`npx prisma migrate resolve --applied 20260421120000_refresh_token`

Así Prisma no intenta volver a aplicar esa migración en el próximo `migrate deploy`. Si nunca usás `migrate` en prod y solo el SQL, al menos asegurate de que el `schema` del repo y la DB coinciden.

---

## Archivo (Prompt 2) — completado, referencia

## Estado actual (Prompt 2 completado)

### Backend
- [x] CategoryMapper — reglas por merchant/descripción → categoría (14 categorías)
- [x] BudgetEngine — getSummary, canAfford, canAffordInInstallments, getProjection, timeToSave, getCategoryBudgetStatus
- [x] POST /api/webhooks/mercadopago — firma X-Signature, fetch Payment API, dedup
- [x] POST /api/webhooks/paypal — verificación API, PAYMENT.SALE.COMPLETED/REVERSED
- [x] POST /api/webhooks/wise — firma public key, transferencias completadas
- [x] POST /api/ingest/csv — multer, BBVA/Galicia/Brubank parsers, dedup
- [x] GET/POST/PATCH/DELETE /api/accounts
- [x] GET/PATCH /api/transactions (filtros + paginación)
- [x] GET /api/budget/summary, /categories/status, /can-afford, /projection, /time-to-save
- [x] GET/POST/PATCH /api/budget
- [x] GET/PATCH /api/settings

### Frontend (Next.js 14 App Router)
- [x] Layout con sidebar — Dashboard, Transacciones, Configuración
- [x] / (Dashboard) — 3 stat cards, gráfico dona por categoría (recharts), últimas 10 tx, barras de presupuesto
- [x] /transactions — tabla paginada, filtros (categoría/fuente/fechas/búsqueda), categorización inline, drag&drop CSV upload
- [x] /settings — CRUD de cuentas, parámetros financieros, uso IA, instrucciones reenvío mail

---

## Prompt 3 — Chat IA + Ingesta automática IMAP + Webhooks reales

### Objetivo
Conectar Claude AI para análisis conversacional y automatizar la ingesta de emails vía IMAP/Gmail.

### 1. Chat con Claude Sonnet

**Endpoint: POST /api/chat**

```typescript
// Contexto que se incluye en el system prompt:
// - Resumen del mes actual (getSummary)
// - Saldo por cuenta
// - Top 5 merchants
// - Estado de presupuesto por categoría
// - UserSettings (ingreso, meta ahorro, límite cuotas)

// Respeta sonnetCallsThisMonth vs sonnetCallsLimit
// Si supera el límite → error 429 con mensaje en español
// Incrementa sonnetCallsThisMonth en UserSettings al usar
```

**Página /chat**
- Input de chat con historial scrolleable
- Burbujas de mensaje (user = derecha, assistant = izquierda)
- Indicador "Pensando..." con animación
- Mostrar cuántas llamadas Sonnet quedan este mes (badge)
- Historial persiste en localStorage (no en DB todavía)

### 2. Fallback Haiku para emails no reconocidos

En emailParser.ts, si ningún parser regex reconoce el mail → llamar a Haiku:

```typescript
// System prompt: "Extraé del siguiente email bancario: amount, currency, merchant, date, accountHint. Respondé SOLO con JSON válido."
// Incrementa haikusCallsThisMonth
// Si el JSON no es parseable → return null (marcar FAILED)
```

### 3. Ingesta IMAP/Gmail

**Servicio: /apps/api/src/services/ImapPoller.ts**

```typescript
// Conecta a IMAP con imap o gmail-api
// Polling cada 5 minutos (configurable en .env: IMAP_POLL_INTERVAL_MS)
// Filtros: solo emails de senders en whitelist (IMAP_WHITELIST_SENDERS)
// Por cada email nuevo → llama a POST /api/ingest/email internamente
// Marca como leído después de procesar
// Se inicia automáticamente cuando NODE_ENV !== 'test'
```

Variables .env a agregar:
```
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=tu@gmail.com
IMAP_PASSWORD=app-specific-password
IMAP_WHITELIST_SENDERS=alertas@galicia.com.ar,notificaciones@brubank.com,...
IMAP_POLL_INTERVAL_MS=300000
ANTHROPIC_API_KEY=
```

### 4. Webhooks reales — configuración

**Mercado Pago:**
```bash
curl -X POST https://api.mercadopago.com/v1/webhooks \
  -H "Authorization: Bearer $MP_ACCESS_TOKEN" \
  -d '{"url":"https://coach-api.TUNDOMINIO.com/api/webhooks/mercadopago","topic":"payment"}'
```

**PayPal:** Dashboard → My Apps → Webhooks → Add Webhook → coach-api.TUNDOMINIO.com/api/webhooks/paypal

**Wise:** Settings → Developer Tools → Webhooks → Add webhook → Trigger: transfers#state-change

### 5. Página /analyze (nuevo)

- Input: "¿Puedo comprar X por $Y?" → llama a /api/budget/can-afford → muestra resultado + consejo de Haiku
- Input: "Pagarlo en N cuotas" → llama a /api/budget/can-afford-installments
- Proyección de saldo a 6 meses (gráfico de línea con recharts)
- "¿Cuándo puedo ahorrar $X?" → llama a /api/budget/time-to-save

---

## Prompt 4 — Presupuestos completos + Reportes + PWA

### Objetivos

1. **CRUD completo de presupuestos** desde /settings (Prompt 2 tiene el backend, falta el UI)
2. **Alertas** cuando categoría supera 80% → toast en dashboard + email (opcional)
3. **Reporte mensual PDF**
   - Summary de ingresos/gastos/ahorro
   - Top merchants
   - Estado de cada categoría vs presupuesto
   - Párrafo de análisis generado por Sonnet
4. **Gráfico de evolución de saldo** en el tiempo (área chart en /dashboard)
5. **PWA** — manifest + service worker para usar en mobile
6. **Página /accounts** con historial de balance y gráfico por cuenta

---

## Variables de entorno pendientes de configurar

| Variable | Dónde conseguirla |
|----------|------------------|
| `MP_ACCESS_TOKEN` | mercadopago.com/developers |
| `MP_WEBHOOK_SECRET` | Al crear el webhook en MP |
| `MP_COLLECTOR_ID` | Tu user ID de MP |
| `PAYPAL_CLIENT_ID/SECRET` | developer.paypal.com |
| `PAYPAL_WEBHOOK_ID` | Al crear el webhook en PayPal |
| `WISE_API_TOKEN` | wise.com → Settings → API tokens |
| `WISE_WEBHOOK_PUBLIC_KEY` | wise.com → Webhooks → Public key |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `IMAP_USER/PASSWORD` | App-specific password de Google |

## Comandos útiles

```bash
# Levantar todo
./start.sh

# Solo API (puerto 4000)
npm run dev --workspace=apps/api

# Solo frontend (puerto 3000)
npm run dev --workspace=apps/web

# Migrar DB
npm run db:migrate

# Test email ingest manual
curl -X POST http://localhost:4000/api/ingest/email \
  -H "Content-Type: application/json" \
  -d '{"from":"alertas@galicia.com.ar","subject":"Consumo con tu tarjeta terminada en 1234","textBody":"Consumo de $5.200,00 en SUPERMERCADO COTO el 19/04/2026"}'

# Test CSV import
curl -X POST http://localhost:4000/api/ingest/csv \
  -F "file=@extracto.csv" \
  -F "provider=GALICIA"
```
