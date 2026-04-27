# Coach Financiero — Contexto de producto y roadmap

**Última actualización:** 20 abr 2026  
Este archivo describe el **alcance real** del código hoy, la **visión** hacia un producto “autopilot” financiero, y un **plan por fases** con pasos accionables. Los ítems **ya implementados** van con `[x]` y ~~tachados~~.

> **Prioridad y orden del MVP:** La fuente canónica es **`masterplan.md`** (en particular **§4 buenas prácticas** y **§6 orden de implementación**). Si el texto de este `contexto.md` entrara en conflicto con el master plan, manda el plan maestro.

---

## 1. Alcance actual (qué hace el sistema hoy)

Monorepo: **`apps/web`** (Next.js 14), **`apps/api`** (Express + TS), **`packages/db`** (Prisma + PostgreSQL). Deploy típico: **Railway** (API) + **Cloudflare Pages** (web).

### 1.1 Ingesta y datos

| Área | Estado |
|------|--------|
| ~~Cuentas bancarias / billeteras (CRUD)~~ | `[x]` |
| ~~Transacciones (listado, filtros básicos, paginación, edición categoría/descripción)~~ | `[x]` |
| ~~Ingesta CSV (BBVA / Galicia / Brubank según parsers)~~ | `[x]` |
| ~~Ingesta por API de mail (`/api/ingest/email`)~~ | `[x]` |
| ~~Webhooks Mercado Pago, PayPal, Wise~~ | `[x]` |
| ~~IMAP historial (servicio dedicado, senders conocidos)~~ | `[x]` |
| ~~Gmail: OAuth por usuario, varias cuentas `ConnectedEmail`~~ | `[x]` |
| ~~Import Gmail: query por remitentes (bancos + delivery + pagos), límite configurable, paginación API~~ | `[x]` |
| ~~Import Gmail: dedup por `Message-ID`, metadatos antes que `full`, keep-alive SSE, reintentos 429~~ | `[x]` |
| ~~Import Gmail: **completar huérfanos** (ingest sin `transactionId` cuando ya existe cuenta)~~ | `[x]` |
| ~~Parsers regex por proveedor (Galicia, BBVA, Brubank, MP, PayPal, Wise, Rappi, PedidosYa, ML, Uber…)~~ | `[x]` |
| ~~`EmailIngest` + deduplicación por `messageId`~~ | `[x]` |
| Polling IMAP automático tipo “siempre encendido” en API | `[ ]` (no como `ImapPoller.ts` del doc viejo; hoy es import bajo demanda + IMAP batch) |
| Haiku fallback automático para mails no parseados por regex | `[ ]` (planeado en NEXT_STEPS, no verificado como cerrado) |

### 1.2 Presupuesto y reglas

| Área | Estado |
|------|--------|
| ~~`BudgetEngine`: resumen, canAfford, cuotas, proyección, tiempo para ahorrar~~ | `[x]` |
| ~~API `/api/budget/*` (resumen, categorías, can-afford, proyección, etc.)~~ | `[x]` |
| ~~`UserSettings`: ingreso promedio, meta ahorro %, límite cuotas %, límites IA~~ | `[x]` |
| Objetivos financieros explícitos (meta “quiero X en fecha Y”, inversión, deuda cero) en UI + modelo | `[ ]` |
| Motor de **deuda / préstamo / cuotas** como entidades de primer nivel (capital, TNA, vencimientos) | `[ ]` |

### 1.3 Experiencia web

| Área | Estado |
|------|--------|
| ~~Dashboard (resumen, categorías, últimas tx, presupuesto)~~ | `[x]` |
| ~~Transacciones (tabla, filtros, CSV drag&drop)~~ | `[x]` |
| ~~Configuración (cuentas, parámetros, Gmail conectado, import, onboarding)~~ | `[x]` |
| ~~Historia financiera: analytics mensual/anual/trends; pestañas de años ampliadas (API)~~ | `[x]` |
| ~~Coach IA (ruta API + uso en web; límites Sonnet/Haiku en settings)~~ | `[x]` |
| ~~Auth: access JWT 15m + **refresh 30d** (cookie `coach_rt` httpOnly, tabla `RefreshToken`, `POST /api/auth/refresh` y `logout`); login/registro, OAuth Google, Gmail OAuth~~ | `[x]` |
| ~~API: **Helmet** + **rate limit** (auth 10/min, coach 20/min, ingest 50/h, global 200/min)~~ | `[x]` |
| ~~**Recuperar contraseña** (Resend, `RESEND_FROM` en el API, forgot/reset)~~ | `[x]` |
| ~~**Verificación de email** (6 dígitos, `/verify-email`, send/verify, probado en prod)~~ | `[x]` |
| ~~**Eliminar cuenta** (Ajustes, `POST /api/auth/delete-account`, confirmar email)~~ | `[x]` (anticipo respecto a ítem 32 GDPR del `masterplan`) |
| ~~Rutas auth: `ClientShell` envuelve en contenedor `w-full flex-1` (el `body` en flex dejaba texto/“Cargando…” pegado a la izquierda); fallback de `/reset-password` (Suspense) a pantalla completa y centrado~~ | `[x]` |
| PWA / offline | `[ ]` parcial (`next-pwa` existe; alcance UX no auditado aquí) |

### 1.4 Lo que **no** es hoy (importante)

- **No** se importa “toda la casilla”: solo mails que coinciden con la **query de Gmail** (remitentes acotados).
- **No** hay **match cruzado** entre correos (p. ej. un débito del banco + un recibo de Rappi por fecha/monto). Cada mail se parsea **aislado**.
- **No** hay garantía de categoría “Transferencias” para cualquier texto “transferencia a fulanito”: depende del parser del banco/proveedor.
- **Multi-usuario**: el API debe seguir endureciendo `userId` en **todas** las rutas sensibles (varias rutas históricas asumían un solo usuario).

---

## 2. Visión — Producto “completo” (autopilot financiero)

Objetivo: que **vos te olvides** de cargar cosas a mano en lo posible, y que el sistema:

1. **Recuerde** todo lo relevante (movimientos, deudas, cuotas, límites, objetivos).
2. **Reconcilie** automáticamente cuando haya señales cruzadas (banco + comercio + wallet).
3. **Responda** con certeza razonable: “¿puedo comprar X?”, “¿en cuotas?”, “¿cuánto me falta para el objetivo?”.
4. **Anticipe** problemas (vencimientos, sobregiro, cuota que te deja sin margen).

Esto implica **datos**, **reglas**, **ML/heurísticas**, y **UX** de confianza (explicabilidad).

---

## 3. Fases y plan detallado

Cada fase tiene **pasos** ordenados. Los ítems ya cubiertos por el alcance actual aparecen ~~tachados~~ con `[x]`.

---

### ~~Fase 0 — Cimientos del producto (MVP datos)~~ `[x]` *en gran parte*

1. ~~Modelo `User`, `Account`, `Transaction`, categorías, fuentes (EMAIL, CSV, API, MANUAL).~~
2. ~~Ingesta CSV + webhooks + mail puntual.~~
3. ~~CRUD cuentas y transacciones en web.~~
4. ~~Presupuesto por categoría + motor can-afford / cuotas según settings.~~
5. ~~Dashboard mínimo viable.~~
6. Endurecer **multi-tenant**: `userId` en **todas** las queries de `transactions`, `notifications`, agregados, etc. + tests de regresión. `[ ]`

---

### ~~Fase 1 — Ingesta rica por correo (Gmail + parsers)~~ `[x]` *núcleo hecho*

1. ~~OAuth Gmail + almacenamiento de tokens por cuenta.~~
2. ~~Lista de remitentes en query Gmail alineada a parsers.~~
3. ~~Import con progreso SSE, límites, paginación de lista Gmail.~~
4. ~~Optimización duplicados (metadata) + keep-alive.~~
5. ~~Completar ingests huérfanos cuando el usuario crea cuenta después.~~
6. Ampliar remitentes y parsers (más bancos, más formatos HTML). `[ ]` *continuo*
7. Fallback IA (Haiku) para formato desconocido: implementar y medir costo/cuota. `[ ]`
8. Panel “**Cola de fallidos**”: reintentar parse, editar raw, marcar “ignorar”. `[ ]`

---

### Fase 2 — Modelo financiero completo (deudas, cuotas, préstamos)

*Objetivo: que “cuotas / préstamos / tarjeta” no sean solo texto en una transacción.*

1. **Diseño de datos**
   - [ ] Entidad `Loan` o `DebtAccount`: capital inicial, moneda, TNA/TEM, fecha inicio, cuota fija o sistema francés, entidad acreedora.
   - [ ] Entidad `InstallmentPlan` vinculada a una `Transaction` o a un comercio: N cuotas, monto cuota, fechas esperadas, estado (al día / atrasada / cancelada).
   - [ ] Entidad `RecurringCharge` (suscripciones) con periodicidad y próximo débito.
   - [ ] Migraciones Prisma + índices por `userId` y fechas.

2. **Ingesta**
   - [ ] Detectar en parsers / plantillas: “cuota N de M”, “préstamo”, “resumen tarjeta” y poblar las entidades nuevas (aunque sea heurístico al inicio).
   - [ ] UI para **confirmar** propuesta del sistema (wizard “¿esto es un préstamo?”).

3. **Motor**
   - [ ] Extender `BudgetEngine` para restar **compromisos futuros** (cuotas + mínimos tarjeta + préstamos) del “disponible real”.
   - [ ] API: `GET /api/obligations/summary`, `GET /api/installments/upcoming`.

4. **Frontend**
   - [ ] Pantalla “Deudas y cuotas” con timeline.
   - [ ] En detalle de transacción: ver/editar plan de cuotas vinculado.

---

### Fase 3 — Objetivos (ahorro, inversión, compra grande)

*Objetivo: metas explícitas con seguimiento automático.*

1. **Modelo**
   - [ ] `SavingsGoal`: monto objetivo, fecha objetivo, cuenta destino, aportes automáticos/manual.
   - [ ] `InvestmentGoal` o “bucket”: riesgo, horizonte, aporte mensual sugerido (regla simple al inicio).
   - [ ] `PurchaseIntent`: categoría o ítem (“notebook”), monto tope, fecha límite opcional.

2. **Motor**
   - [ ] Proyección: “si seguís este ritmo de ahorro, llegás el …”.
   - [ ] Alertas: “esta semana te alejaste X% del objetivo”.

3. **Frontend**
   - [ ] Wizard “Nuevo objetivo” + gráfico de progreso en Dashboard e Historia.
   - [ ] Integración con `can-afford`: mostrar **margen después de objetivos**.

---

### Fase 4 — Match cruzado y reconciliación (el “cerebro”)

*Objetivo: unificar señales de distintas fuentes en un solo movimiento o “hecho económico”.*

1. **Modelo**
   - [ ] `RawEvent` o conservar `EmailIngest` + `WebhookEvent` normalizado.
   - [ ] `MatchCandidate`: pares (evento A, evento B), score, motivo (monto ±ε, fecha ±N días, merchant normalizado).
   - [ ] `LedgerEntry` consolidado (opcional) o transacción “canónica” con `sources[]`.

2. **Algoritmo v1 (heurístico)**
   - [ ] Normalizar montos y monedas; ventana temporal configurable (ej. ±3 días).
   - [ ] Reglas por canal: “MP webhook + mail del mismo comercio”, “débito Galicia + notificación MP”.
   - [ ] Cola de revisión humana para score medio.

3. **Algoritmo v2**
   - [ ] Embeddings o features de merchant + monto para sugerir match (opcional, costo).
   - [ ] Aprendizaje de confirmaciones del usuario (“sí eran el mismo / no”).

4. **Frontend**
   - [ ] Bandeja “**Para revisar**”: pares sugeridos, un clic para fusionar o separar.
   - [ ] Historial de decisiones (auditoría).

---

### Fase 5 — “¿Puedo comprar…?” (producto copiloto)

*Objetivo: respuestas accionables con reglas claras.*

1. **Inputs**
   - [ ] API `POST /api/advice/can-buy` con `{ amount, category?, installments?, merchant? }`.
   - [ ] Usar: saldos, presupuesto categoría, límite cuotas % settings, **obligaciones** Fase 2, **objetivos** Fase 3.

2. **Explicabilidad**
   - [ ] Respuesta estructurada: `{ allowed, reasons[], breakdown }` para mostrar en UI sin caja negra.

3. **Coach IA**
   - [ ] System prompt alimentado con el mismo JSON de breakdown (no inventar números).
   - [ ] Modo “conservador / normal / agresivo” según perfil de riesgo del usuario.

4. **Frontend**
   - [ ] Widget en Dashboard y en página dedicada “Simulador”.
   - [ ] Atajo desde una categoría: “¿Cuánto me queda para gastar acá este mes?”.

---

### Fase 6 — Autopilot y “olvidate de lo manual”

1. **Automatización**
   - [ ] Job programado: re-import Gmail incremental (`after:lastSync`), sin clic del usuario.
   - [ ] Webhooks ya en tiempo real; unificar estado “última sincronización por fuente”.

2. **Notificaciones**
   - [ ] Push/email in-app: vencimiento cuota, objetivo en riesgo, match pendiente, webhook fallido.
   - [ ] Preferencias granulares por tipo de alerta.

3. **Resiliencia**
   - [ ] Reintentos idempotentes, dead letter para webhooks, métricas en logs.

4. **Calidad**
   - [ ] Suite e2e crítica (login → import → ver transacción).
   - [ ] Telemetría de parse rate por proveedor.

---

### Fase 7 — Confianza, seguridad y escala

1. [ ] Auditoría de permisos OAuth (scopes mínimos, rotación).
2. [ ] Cifrado en reposo para tokens si el proveedor lo permite / secret manager.
3. [ ] RGPD-style: exportar / borrar datos de usuario.
4. [ ] Plan multi-familia / espacios de trabajo (si aplica negocio).

---

## 4. Cómo usar este documento

- **Producto / IA / vos:** priorizá fases según dolor (ej. si hoy duele “no veo deudas”, acelerá Fase 2 antes que match cruzado).
- **Desarrollo:** cada paso debería poder convertirse en **issue** con criterio de aceptación.
- **Mantenimiento:** cuando se complete un paso, marcá `[x]` y ~~tachá~~ la línea en este archivo (o el checklist del issue y un link acá).

---

## 5. Resumen ejecutivo

| Hoy | Mañana (visión) |
|-----|------------------|
| Muchas fuentes → **transacciones** | Mismas fuentes → **eventos** → **reconciliación** → transacción canónica |
| Parsers por mail aislado | Match cruzado + confirmación usuario |
| Presupuesto + can-afford simple | Objetivos + deudas + cuotas en el mismo motor |
| Coach con contexto parcial | Coach con **breakdown** verificable (sin alucinar montos) |

---

*Fin del documento `contexto.md`.*
