# CLAUDE.md — Coach Financiero IA

> Leer este archivo al inicio de cada sesión. Es el contexto operativo para Claude Code.
> Fuente de verdad del proyecto: `masterplan.md` (§4 buenas prácticas, §6 orden de implementación).

---

## Stack

| Capa | Tecnología | Deploy |
|------|-----------|--------|
| Frontend | Next.js 14 App Router + Tailwind + Recharts | Cloudflare Pages |
| Backend | Express + TypeScript | Railway |
| DB | PostgreSQL + Prisma ORM | Railway |
| Auth | NextAuth.js + JWT (access 15m / refresh 30d) | En API |
| IA | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) + Sonnet 4.6 (`claude-sonnet-4-6`) | Anthropic API |
| Mail | Resend (3k/mes gratis) | SaaS |
| Monorepo | npm workspaces | `apps/web`, `apps/api`, `packages/db` |

---

## Estructura de archivos clave

```
apps/api/src/
  routes/           — endpoints Express
  services/
    emailParser.ts  — parsers regex por proveedor bancario
    budgetEngine.ts — motor financiero (canAfford, projection, etc.)
    categoryMapper.ts
  middleware/       — auth, requireUserId, errorHandler

apps/web/app/       — páginas Next.js (App Router)

packages/db/
  schema.prisma     — fuente de verdad del modelo de datos
```

---

## Reglas que aplican a TODO el código nuevo (no repetir en cada tarea)

### 1. Multi-tenant obligatorio
- **Toda** query Prisma incluye `where: { userId }` — sin excepción.
- Usar helper `requireUserId(req)` del middleware para extraer `userId` del JWT.
- Nunca asumir un solo usuario.

### 2. IA nunca calcula, solo narra
- BudgetEngine hace los cálculos → Haiku escribe la frase o el párrafo.
- El system prompt de cualquier llamada a IA recibe JSON con los números ya calculados.
- Haiku para: parsing fallback, categorización desconocida, narrativas cortas.
- Sonnet para: análisis profundo a pedido (verificar límite mensual en `UserSettings`).

### 3. Error handling
- **API**: middleware global → siempre `{ error: string, code: string }`, nunca stack traces al cliente.
- **API**: validar inputs con `zod`, mensajes en español.
- **Frontend**: Error Boundary global en `layout.tsx`.
- **Frontend**: toasts con `sonner` para errores y éxitos.
- Toda llamada async tiene loading state (skeleton o spinner) y error state con mensaje amigable.

### 4. Formato regional argentino — usar siempre estas utilidades
```ts
formatMoney(n)  // Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })
formatDate(d)   // Intl.DateTimeFormat('es-AR') — guardar UTC en DB, mostrar America/Argentina/Buenos_Aires
```

### 5. Mobile-first
- Tablas: en <768px colapsar a merchant + monto + fecha.
- Modales: en mobile → full-screen o bottom sheet.
- Touch targets mínimo 44×44px, inputs mínimo height 48px.
- Gráficos Recharts: siempre `width="100%"` con contenedor responsivo.
- Verificar en Chrome DevTools 390px antes de marcar una feature como terminada.

### 6. Seguridad (ya configurado, no romper)
- `helmet()` activo en Express.
- Rate limits: auth 10/min · coach 20/min · ingest 50/h · global 200/min.
- CORS restringido al dominio del frontend en producción.
- Secrets siempre en `.env`, nunca hardcodeados.

### 7. Rendimiento
- Debounce 300ms en inputs de búsqueda.
- Nunca más de 50 items sin paginación.
- No agregar librerías pesadas sin revisar alternativas.

---

## Estado actual — ya implementado (no tocar sin razón)

**Auth:** access JWT 15m + refresh 30d (cookie `coach_rt` httpOnly), tabla `RefreshToken`, reset contraseña, verificación email 6 dígitos, eliminar cuenta, OAuth Google.

**Ingesta:** CSV (BBVA/Galicia/Brubank), webhooks MP/PayPal/Wise con verificación de firma, Gmail OAuth con import SSE, dedup por `messageId`, parsers regex por proveedor, completar huérfanos.

**Motor:** `BudgetEngine` (getSummary, canAfford, canAffordInInstallments, getProjection, timeToSave), `classifyIntent()` regex para routing Haiku/Sonnet.

**API:** `/api/accounts`, `/api/transactions` (paginado + filtros), `/api/budget/*`, `/api/coach/message`, `/api/settings`, `/api/notifications`, `/api/health`, `/api/ingest/*`, `/api/webhooks/*`.

**Frontend:** Dashboard, Transacciones, Settings, Coach `/coach`, Historia, auth completo.

---

## Próximos ítems (Fase 1 MVP — en orden)

| # | Tarea | Estado |
|---|-------|--------|
| 4a | UX login: mostrar "Iniciar sesión" primero si hay señal de dispositivo conocido (IP / localStorage) | ✅ done |
| 5 | Toasts con `sonner` + Error Boundary global en `layout.tsx` | ✅ done |
| 6 | `formatMoney()` y `formatDate()` centralizados en `apps/web/lib/format.ts` y `apps/api/src/utils/format.ts` | pendiente |
| 7 | Flag `isInternalTransfer` + `isIgnored` en `Transaction` + UI para marcarlos | pendiente |
| 8 | Tabla `ExchangeRate` + `RateService` (cotización blue de bluelytics.com.ar) | pendiente |
| 9 | Campo `currency` + `exchangeRate` en `Transaction` | pendiente |
| 10 | Tabla `LearnedRule` + `CategoryMapper` que las prioriza | pendiente |
| 11 | Wizard "¿De qué fue esto?" para transacciones ambiguas | pendiente |
| 12 | Tabla `MatchCandidate` + `TransactionMatcher` heurístico | pendiente |
| 13 | Sección "Para revisar" en Dashboard | pendiente |
| 14 | Split / merge / ignorar transacciones | pendiente |
| 15 | Auditoría multi-tenant completa + tests de regresión | pendiente |

---

## Modelos Prisma pendientes de crear

```
RefreshToken     — ya existe (Fase 1, ítem 1)
ExchangeRate     — historial cotización USD
LearnedRule      — reglas de categorización del usuario
MatchCandidate   — pares candidatos a merge
Loan             — préstamos/deudas (Fase 2)
InstallmentPlan  — plan de cuotas (Fase 2)
RecurringCharge  — suscripciones (Fase 2)
SavingsGoal      — objetivos de ahorro (Fase 3)
Subscription     — plan FREE/PRO (Fase 3)
MatchFeedback    — historial de decisiones (Fase 4)
```

---

## Comandos útiles

```bash
npm run dev                          # API (4000) + frontend (3000) en paralelo
npm run dev --workspace=apps/api     # Solo backend
npm run dev --workspace=apps/web     # Solo frontend
npm run db:migrate                   # Aplicar migraciones Prisma
npm run db:studio                    # Prisma Studio
npm run smoke:limits                 # Test Helmet + rate limiting
npm run smoke:email                  # Test verificación de email
```

---

## Contexto del usuario final

- Argentino, ingresos variables en USD (Wise, PayPal, cripto USDC/USDT).
- Bancos: Galicia, BBVA, Brubank, Mercado Pago.
- Flujo habitual: cobrar USD → cambiar a ARS (blue) → gastar en ARS.
- Pain points: match Rappi/MP con débito bancario, transferencias propias que inflan gastos, multi-moneda.
