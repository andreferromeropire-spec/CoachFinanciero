# NEXT_STEPS — Prompt 3

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
