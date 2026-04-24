# MASTER PLAN v2.0 — Coach Financiero IA
> Leer al inicio de CADA sesión de Claude Code. Este archivo es el contexto maestro del proyecto.

---

## 1. Stack

| Capa | Tecnología | Deploy |
|------|-----------|--------|
| Frontend | Next.js 14 (App Router) + Tailwind + Recharts | Cloudflare Pages |
| Backend | Node.js + Express + TypeScript | Railway |
| DB | PostgreSQL + Prisma ORM | Railway |
| Auth | NextAuth.js + JWT | En API |
| IA | Claude Haiku 4.5 + Sonnet 4.6 | Anthropic API |
| Mail | Resend (resend.com, tier gratis 3k/mes) | SaaS |
| Monorepo | npm workspaces | apps/web, apps/api, packages/db |

---

## 2. Estado actual (ya implementado, no tocar)

**Backend:**
- CRUD: `/api/accounts`, `/api/transactions` (paginado + filtros)
- Ingesta: `/api/ingest/email`, `/api/ingest/csv` (BBVA/Galicia/Brubank)
- Webhooks: `/api/webhooks/mercadopago`, `/paypal`, `/wise` (con verificación de firma)
- BudgetEngine: `getSummary`, `canAfford`, `canAffordInInstallments`, `getProjection`, `timeToSave`
- Coach IA: `/api/coach/message` con `classifyIntent()` regex → Haiku/Sonnet según intención
- Gmail OAuth: import SSE, dedup por messageId, parsers bancos y delivery
- `/api/notifications`, `/api/health`, `/api/settings`

**Frontend:**
- Dashboard, Transacciones, Settings, Coach `/coach`, Historia
- Auth: login/registro JWT + OAuth Google

---

## 3. Regla de oro: IA vs código

| Situación | Solución |
|-----------|----------|
| ¿Puedo comprar X? | BudgetEngine (código puro) |
| Categorizar merchant conocido | CategoryMapper o LearnedRule (regex) |
| Categorizar merchant desconocido | Haiku (1 llamada, guardar como LearnedRule) |
| Match banco + comercio | Score heurístico (código) |
| Narrativa de anomalía detectada | Código detecta → Haiku escribe la frase |
| Resumen semanal por mail | Código arma JSON → Haiku escribe el mail |
| Análisis profundo a pedido | Sonnet (con límite mensual) |
| Parsing de mail conocido | Parser regex por proveedor |
| Parsing de mail desconocido | Haiku fallback (guardar resultado) |
| Párrafo análisis PDF mensual | Código genera todo → Haiku escribe 1 párrafo |

**La IA nunca calcula. Solo narra resultados de cálculos hechos en código.**

---

## 4. Buenas prácticas SaaS — OBLIGATORIAS en todo código nuevo

Estas reglas aplican a CADA cambio, sin necesidad de mencionarlas en cada tarea.

### 4.1 Sesión persistente (Access + Refresh Token)

El JWT simple actual pierde sesión al refrescar. Reemplazar con:

- **Access token**: vida 15 min, en header `Authorization: Bearer`
- **Refresh token**: vida 30 días, en cookie `httpOnly + secure + sameSite=strict`
- Tabla `RefreshToken` en DB: `{ id, userId, tokenHash, expiresAt, revokedAt, userAgent, ip }`
- Al expirar el access token: frontend hace refresh silencioso → usuario nunca ve "sesión expirada"
- Al logout: revocar refresh token en DB → permite "cerrar sesión en todos los dispositivos"

```
httpOnly: true        // JS no puede leer el token (protege XSS)
secure: true          // Solo HTTPS
sameSite: 'strict'    // Protege CSRF (mismo “site” que el API)
maxAge: 30 * 24 * 60 * 60  // 30 días
```

> **Nota de despliegue (web en Cloudflare Pages + API en otro origen):** en producción la cookie de refresh usa `SameSite=None` y `Secure` para que el navegador la envíe en `fetch` cross-origin hacia el API. En local (API y web en `localhost` con distinto puerto) suele usarse `SameSite=Lax`. El código vive en `apps/api/src/routes/auth.ts` (`refreshCookieOptions`).

### 4.2 Mobile-first

- Tablas de transacciones: en mobile (<768px) colapsar columnas secundarias, solo monto + merchant + fecha
- Sidebar: en mobile → bottom navigation bar (4 íconos) o hamburger
- Modales: en mobile → full-screen o bottom sheet, nunca ventana flotante centrada
- Inputs: height mínimo 48px, touch targets mínimo 44x44px
- Gráficos recharts: siempre `width="100%"` con contenedor responsivo, nunca px fijo
- **Prueba obligatoria**: cada feature verificada en Chrome DevTools 390px (iPhone) antes de marcar como terminada

### 4.3 Performance

- Loading states: TODA llamada async tiene skeleton o spinner. Nunca pantalla en blanco.
- Error states: TODA llamada async maneja el error con mensaje amigable en español.
- Debounce 300ms en inputs de búsqueda antes de llamar al API.
- Nunca cargar más de 50 items sin paginación.
- No agregar librerías pesadas sin revisar alternativas.

### 4.4 Error handling

- **Frontend**: Error Boundary global en layout.tsx — captura crashes y muestra página amigable
- **Frontend**: Toast notifications con `sonner` (liviano, <5kb) para errores y éxitos
- **API**: Middleware global de error en Express → siempre retorna `{ error: string, code: string }`
- **API**: Nunca enviar stack traces al cliente
- **API**: Validación de inputs con `zod`, mensajes de error en español
- Errores de terceros (Gmail, Anthropic, webhooks): siempre try/catch con fallback gracioso

### 4.5 Seguridad

- `helmet()` en el API de Express (headers de seguridad HTTP automáticos)
- Rate limiting con `express-rate-limit`:
  - `/api/auth/*`: 10 req/min
  - `/api/coach/*`: 20 req/min
  - `/api/ingest/*`: 50 req/hora
  - Global: 200 req/min por IP
- CORS restringido al dominio del frontend en producción
- Variables de entorno: NUNCA hardcodear secrets. Siempre en `.env`.
- Tokens OAuth Gmail: no guardar en plain text

### 4.6 Formato regional argentino

Centralizar en utilidades `formatMoney()` y `formatDate()` y reutilizar en todo el codebase:

```ts
// Números
Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })
// → $1.234.567,89

// Fechas
Intl.DateTimeFormat('es-AR')
// → DD/MM/YYYY

// Zona horaria: guardar siempre UTC en DB, mostrar en America/Argentina/Buenos_Aires
```

### 4.7 Multi-tenant

- **TODA** query Prisma incluye `where: { userId }` — sin excepción
- Helper `requireUserId(req)` en middleware que extrae userId del JWT
- Nunca asumir que hay un solo usuario

### 4.8 Estados vacíos

Cada lista/vista tiene 3 estados diseñados: loading, empty state, con datos.
- Transacciones vacías: ilustración + texto + botón "Importar de Gmail"
- Dashboard sin datos: mostrar datos de demo marcados como "Ejemplo" + botón "Importar mis datos"
- Acciones destructivas: siempre confirmar con modal antes de borrar

### 4.9 Accesibilidad básica

- Contraste mínimo 4.5:1 para texto
- Todo `<input>` tiene `<label>` asociado (no solo placeholder)
- Focus visible al navegar con teclado
- HTML semántico: `<button>` para acciones, `<a>` para navegación

### 4.10 Monitoreo (Fase 4, pero pensar desde ahora)

- `/api/health` mejorado: verifica DB + jobs cron + último Gmail sync exitoso
- UptimeRobot: ping a `/api/health` cada 5 min, alerta por email (gratis)
- Sentry tier gratis: 5000 errores/mes, una línea para capturar excepciones automáticamente

---

## 5. Modelos nuevos de Prisma a crear

| Modelo | Propósito | Fase |
|--------|-----------|------|
| `RefreshToken` | Sesión persistente segura | 1 |
| `ExchangeRate` | Historial de cotizaciones USD diarias | 1 |
| `LearnedRule` | Reglas de categorización aprendidas del usuario | 1 |
| `MatchCandidate` | Pares de transacciones candidatas a merge | 1 |
| `Loan` | Préstamos y deudas como entidades | 2 |
| `InstallmentPlan` | Plan de cuotas vinculado a tx o Loan | 2 |
| `RecurringCharge` | Suscripciones y cobros periódicos | 2 |
| `SavingsGoal` | Objetivos de ahorro con seguimiento | 3 |
| `Subscription` | Plan FREE/PRO del usuario | 3 |
| `MatchFeedback` | Historial de decisiones sobre matches | 4 |

**Cambios en modelos existentes:**
- `User`: + `passwordResetToken`, `passwordResetExpiry`, `emailVerifiedAt`, `twoFactorSecret`, `twoFactorEnabled`, `backupCodes`, `termsAcceptedAt`
- `Transaction`: + `currency`, `exchangeRate`, `isInternalTransfer`, `isIgnored`, `needsClassification`, `parentTransactionId`
- `UserSettings`: + `primaryCurrency`, `incomeType` (FIXED|VARIABLE), `riskProfile` (CONSERVATIVE|NORMAL|AGGRESSIVE)

---

## 6. Orden de implementación

### Fase 1 — MVP personal (semanas 1–3) 🔴 PRIORIDAD MÁXIMA

1. **Sesión persistente** — RefreshToken en DB + cookies HttpOnly (reemplaza JWT simple)
2. **Helmet.js + Rate limiting** — seguridad básica
3. **Reset de contraseña** — Resend + token en DB (1h de validez)
4. **Verificación de email** — token 6 dígitos, 10 min de validez
5. **Toast notifications + Error boundary global** — UX de errores
6. **Formato regional argentino** — utilidades `formatMoney()` y `formatDate()` centralizadas
7. **Flag `isInternalTransfer` + `isIgnored`** — para que los totales no estén inflados
8. **Tabla `ExchangeRate` + RateService** — cotización blue de bluelytics.com.ar
9. **Campo `currency` + `exchangeRate` en `Transaction`** — soporte multi-moneda
10. **Tabla `LearnedRule` + CategoryMapper actualizado** — reglas del usuario primero
11. **Wizard "¿De qué fue esto?"** — modal para clasificar tx ambiguas
12. **Tabla `MatchCandidate` + TransactionMatcher** — match banco + comercio heurístico
13. **Frontend "Para revisar"** — sección en dashboard con pares pendientes
14. **Split/merge/ignorar transacciones** — edición manual completa
15. **Auditoría multi-tenant completa** — userId en todas las queries + tests

**UX de auth (cercana a toasts, puede ir con ítems 4–5 o justo antes):** En `/login` (o pantalla unificada login+registro), mostrar **primero Iniciar sesión** si el contexto es *conocido* (p. ej. la **misma IP** que ya tuvo un login exitoso, y/o señal en el **navegador** de que ya hubo sesión en este dispositivo: `localStorage` u otra heurística). Mostrar **primero Crear cuenta** si es **primera visita** en este dispositivo o **nunca** hubo inicio de sesión registrado. Al hacer login, **persistir IP** (o cabecera `X-Forwarded-For` detrás de proxy) en el usuario o en un log/auditoría, para criterio “conocido” en el API.

**Extra fuera de la numeración 1–15 (ya hecho en código):** **Eliminar cuenta** desde ajustes (`POST /api/auth/delete-account` + confirmación con email) — alineado al espíritu del **ítem 32** (Fase 4) pero implementado de forma básica antes de export completo.

### Fase 2 — Modelo completo (semanas 4–6)

16. 2FA con otplib + qrcode
17. Modelos `Loan` + `InstallmentPlan` + `RecurringCharge`
18. Detección de cuotas en parsers existentes
19. BudgetEngine extendido con compromisos futuros
20. Pantalla "Deudas y cuotas" con timeline
21. Can-afford mejorado con breakdown estructurado `{ allowed, margin, breakdown }`

### Fase 3 — SaaS completo (semanas 7–9)

22. Onboarding wizard + datos de demo para usuarios nuevos
23. Páginas `/terms` y `/privacy` + checkbox en registro
24. Modelo `SavingsGoal` + proyección automática
25. Alertas inteligentes (reglas deterministas + cron, sin IA)
26. Modelo `Subscription` + middleware `checkPlan(feature)`
27. Integración de pagos: MercadoPago (ARG) + Stripe
28. Reporte mensual PDF (pdfmake + 1 llamada Haiku)
29. PWA completar (manifest + push notifications)

### Fase 4 — Autopilot (semanas 10+)

30. Import Gmail automático (cron incremental, sin clic del usuario)
31. Sentry + UptimeRobot
32. Export/delete de datos del usuario (GDPR-style)
33. Match v2 con aprendizaje de feedback
34. Cifrado de tokens OAuth en DB
35. Suite e2e Playwright (login → import → ver tx → coach)

---

## 7. Contexto del usuario

- Argentino, ingresos variables en USD
- Fuentes: Wise, PayPal, cripto (USDC/USDT), algo en ARS
- Bancos: Galicia, BBVA, Brubank, Mercado Pago
- Flujo habitual: cobrar USD → cambiar a ARS (blue) → gastar en ARS
- Pain points principales: match Rappi/MP con débito bancario, transferencias entre cuentas propias que inflan gastos, ingresos multi-moneda
- Objetivo: responder "¿puedo comprar X?" con números reales y confiables

---

## 8. Ubicación de archivos clave

```
apps/api/src/services/emailParser.ts     — parsers de mail por proveedor
apps/api/src/services/budgetEngine.ts    — motor financiero
apps/api/src/services/categoryMapper.ts  — categorización de transacciones
apps/api/src/routes/                     — endpoints del API
packages/db/schema.prisma               — modelos de datos
apps/web/app/                           — páginas Next.js
```

---

## 9. Plan de precios

| Feature | Free | Pro (~$5/mes) |
|---------|------|---------------|
| Cuentas bancarias | Hasta 3 | Ilimitadas |
| Historial | 6 meses | Ilimitado |
| Import Gmail | Manual, 100 mails/vez | Automático + ilimitado |
| Coach IA (Haiku) | 20 msg/mes | 200 msg/mes |
| Coach IA (Sonnet) | No | 10 msg/mes |
| Reporte PDF mensual | No | Sí |
| Objetivos de ahorro | 1 | Ilimitados |
| 2FA | Sí | Sí |
| Export CSV | Sí | Sí |