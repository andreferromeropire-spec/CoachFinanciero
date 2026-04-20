# Coach Financiero IA

Asistente financiero personal con ingesta automática de emails y CSVs bancarios, webhooks de Mercado Pago/PayPal/Wise, y un coach conversacional con Claude AI.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14 (App Router) + Tailwind CSS + Recharts |
| Backend | Node.js + Express + TypeScript |
| Base de datos | PostgreSQL + Prisma ORM |
| Auth | NextAuth.js (contraseña única) |
| IA | Anthropic Claude (Sonnet 4.6 + Haiku 4.5) |
| Tunnel | Cloudflare Tunnel |

## Estructura del proyecto

```
/apps/web           → Frontend Next.js (puerto 3000)
/apps/api           → Backend Express (puerto 4000)
/packages/db        → Prisma schema compartido
```

---

## Setup inicial

### 1. Requisitos del sistema

```bash
node -v        # Node.js 20+
psql --version # PostgreSQL 14+
```

### 2. Clonar e instalar dependencias

```bash
git clone <repo>
cd CoachFinanciero
npm install
```

### 3. Variables de entorno

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Editá ambos archivos. Variables clave:

**apps/api/.env**

```env
DATABASE_URL="postgresql://postgres:TU_PASSWORD@localhost:5432/coach_financiero"
PORT=4000
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development

# IA (obligatorio para el chat)
ANTHROPIC_API_KEY=sk-ant-...

# Mercado Pago (para webhooks)
MP_ACCESS_TOKEN=APP_USR-...
MP_WEBHOOK_SECRET=              # Se genera al crear el webhook
MP_COLLECTOR_ID=                # Tu user ID de MP

# PayPal
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
PAYPAL_SANDBOX=true             # Cambiar a false en producción

# Wise
WISE_API_TOKEN=
WISE_WEBHOOK_PUBLIC_KEY=        # PEM completo del panel de Wise
```

**apps/web/.env.local**

```env
DATABASE_URL="postgresql://postgres:TU_PASSWORD@localhost:5432/coach_financiero"
NEXTAUTH_SECRET="secreto-seguro-al-azar"
NEXTAUTH_URL="http://localhost:3000"
# Desde PC: http://localhost:4000
# Desde celular en la misma red: http://TU_IP_LOCAL:4000
NEXT_PUBLIC_API_URL="http://localhost:4000"
ADMIN_PASSWORD="tu-contraseña-de-acceso"

# Cloudflare (para producción)
PUBLIC_API_URL="https://coach-api.TUNDOMINIO.com"
PUBLIC_WEB_URL="https://coach.TUNDOMINIO.com"
```

### 4. Base de datos

```bash
# Crear la DB (si no existe)
psql -U postgres -c "CREATE DATABASE coach_financiero;"

# Aplicar todas las migraciones
npm run db:migrate
```

### 5. Levantar en desarrollo

```bash
npm run dev
# Frontend: http://localhost:3000
# Backend:  http://localhost:4000
```

### 6. Acceso desde el celular (red local)

El celular no puede resolver `localhost` — necesita la IP de tu máquina en la red local.

```bash
# Obtener tu IP local
ip route get 1 | awk '{print $7}'
# → por ejemplo: 192.168.1.4
```

Editar `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL="http://192.168.1.4:4000"
```

Luego acceder desde el celular a `http://192.168.1.4:3000`.

> **Importante:** Esta variable hay que actualizarla si cambia la IP local (al cambiar de red Wi-Fi o reiniciar el router). En producción con Cloudflare Tunnel apunta automáticamente a la URL pública del backend.

---

## Funcionalidades

### Chat con el Coach IA

Accedé a `/coach` en el frontend. El coach clasifica la intención antes de llamar a la IA:

| Intención | Cómo se resuelve |
|-----------|-----------------|
| ¿Puedo comprar $X? | BudgetEngine (sin IA) |
| ¿En N cuotas? | BudgetEngine (sin IA) |
| Ahorrar para meta $X | BudgetEngine (sin IA) |
| ¿Vale la pena? | Haiku (+ 2 preguntas de seguimiento) |
| Armar presupuesto | Haiku |
| Análisis general | Haiku (Sonnet si el usuario pide más profundidad) |

El límite de Sonnet se configura en `/settings` (default: 20 llamadas/mes). Se resetea el 1° de cada mes.

### Ingesta de emails bancarios

**Endpoint:** `POST /api/ingest/email`

Parsers soportados: Galicia, Brubank, BBVA, Mercado Pago, PayPal, Wise.

```bash
curl -X POST http://localhost:4000/api/ingest/email \
  -H "Content-Type: application/json" \
  -d '{
    "from": "alertas@galicia.com.ar",
    "subject": "Consumo con tu tarjeta terminada en 1234",
    "textBody": "Realizaste un consumo de $5.200,00 en SUPERMERCADO COTO el 19/04/2026"
  }'
```

### Importación CSV

**Endpoint:** `POST /api/ingest/csv` (multipart/form-data)

```bash
curl -X POST http://localhost:4000/api/ingest/csv \
  -F "file=@extracto.csv" \
  -F "provider=GALICIA"   # GALICIA | BBVA | BRUBANK
```

### API REST completa

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/health` | Estado del servidor + DB |
| GET/POST/PATCH/DELETE | `/api/accounts` | CRUD de cuentas |
| GET/PATCH | `/api/transactions` | Listado paginado + filtros |
| GET | `/api/budget/summary` | Resumen del período |
| GET | `/api/budget/can-afford?amount=X` | ¿Podés gastar $X? |
| GET | `/api/budget/can-afford-installments?total=X&installments=N` | Análisis de cuotas |
| GET | `/api/budget/projection?months=6` | Proyección de saldo |
| GET | `/api/budget/time-to-save?target=X` | Tiempo para ahorrar $X |
| GET/PATCH | `/api/settings` | Configuración del usuario |
| POST | `/api/coach/message` | Chat con el coach IA |
| GET | `/api/notifications` | Listado + contador sin leer |

---

## Configuración de Cloudflare Tunnel

### Instalar cloudflared

```bash
# Ubuntu/Debian
curl -L --output cloudflared.deb \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# macOS
brew install cloudflare/cloudflare/cloudflared

# Windows
winget install --id Cloudflare.cloudflared
```

### Configurar el tunnel

```bash
# 1. Login
cloudflared tunnel login

# 2. Crear el tunnel (guardá el TUNNEL_ID del output)
cloudflared tunnel create coachfinanciero

# 3. Editar .cloudflared/config.yml
# Reemplazá TUNDOMINIO por tu dominio real
# Reemplazá TUNNEL_ID por el ID del paso anterior

# 4. Agregar DNS records en el panel de Cloudflare:
#    CNAME  coach       TUNNEL_ID.cfargotunnel.com
#    CNAME  coach-api   TUNNEL_ID.cfargotunnel.com

# 5. Levantar todo
./start.sh
```

---

## Configuración de webhooks

### Mercado Pago

1. Obtené tu `MP_ACCESS_TOKEN` en [mercadopago.com/developers](https://www.mercadopago.com.ar/developers)
2. Registrá el webhook:

```bash
curl -X POST https://api.mercadopago.com/v1/webhooks \
  -H "Authorization: Bearer $MP_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://coach-api.TUNDOMINIO.com/api/webhooks/mercadopago",
    "topic": "payment"
  }'
# El response incluye el secret — copiarlo a MP_WEBHOOK_SECRET
```

3. Copiá el `MP_COLLECTOR_ID` (tu user ID, visible en la URL del panel de MP).

### PayPal

1. Creá una app en [developer.paypal.com](https://developer.paypal.com)
2. Copiá `Client ID` y `Client Secret` a las variables de entorno
3. En My Apps → tu app → Webhooks → Add Webhook:
   - URL: `https://coach-api.TUNDOMINIO.com/api/webhooks/paypal`
   - Eventos: `PAYMENT.SALE.COMPLETED`, `PAYMENT.SALE.REVERSED`
4. Copiá el `Webhook ID` a `PAYPAL_WEBHOOK_ID`
5. Para producción: cambiar `PAYPAL_SANDBOX=false`

### Wise

1. Generá un API token en [wise.com](https://wise.com) → Settings → Developer Tools → API tokens
2. En Webhooks → Add webhook:
   - URL: `https://coach-api.TUNDOMINIO.com/api/webhooks/wise`
   - Trigger: `transfers#state-change`
3. Copiá la public key PEM completa a `WISE_WEBHOOK_PUBLIC_KEY`

---

## Configuración de reenvío automático de emails

### Gmail (método recomendado)

1. En Gmail → ⚙️ Configuración → Reenvío y POP/IMAP
2. Agregar dirección de reenvío (crear una dirección catch-all o usar Make/Zapier)
3. Crear filtros para cada banco:

| Banco | De | Asunto contiene |
|-------|-----|----------------|
| Galicia | `alertas@galicia.com.ar` | Consumo, Débito |
| Brubank | `no-reply@brubank.com` | — |
| BBVA | `alertas@bbva.com.ar` | — |
| MercadoPago | `no-reply@mercadopago.com` | Realizaste un pago |
| PayPal | `service@paypal.com` | Enviaste, Recibiste |
| Wise | `no-reply@wise.com` | — |

4. Acción: Reenviar a tu webhook via Make.com o un script de Google Apps Script:

```javascript
// Google Apps Script — reenvío automático
function checkEmails() {
  const threads = GmailApp.search('from:(alertas@galicia.com.ar OR no-reply@brubank.com) newer_than:1d');
  threads.forEach(thread => {
    const msg = thread.getMessages()[0];
    UrlFetchApp.fetch('https://coach-api.TUNDOMINIO.com/api/ingest/email', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        from: msg.getFrom(),
        subject: msg.getSubject(),
        textBody: msg.getPlainBody(),
        htmlBody: msg.getBody(),
        receivedAt: msg.getDate().toISOString()
      })
    });
  });
}
// Configurar trigger: cada 5 minutos
```

### Envío directo por API

Si tenés acceso al mail server, podés hacer `POST /api/ingest/email` directamente con el contenido del email.

---

## Comandos útiles

```bash
# Desarrollo
npm run dev                     # API + frontend en paralelo
npm run dev --workspace=apps/api  # Solo backend
npm run dev --workspace=apps/web  # Solo frontend

# Base de datos
npm run db:migrate              # Aplicar migraciones pendientes
npm run db:studio               # Abrir Prisma Studio (UI de la DB)
npm run db:generate             # Regenerar el cliente Prisma

# Producción
./start.sh                      # API + frontend + cloudflared
```

---

## Arquitectura del Coach IA

```
Usuario pregunta
      ↓
classifyIntent() ← regex, sin IA
      ↓
┌─────────────────────────────────────────────┐
│ SIMPLE_AFFORDABILITY / INSTALLMENT / SAVINGS │
│   → BudgetEngine (sin IA, respuesta directa) │
└─────────────────────────────────────────────┘
      ↓ si no se resuelve
┌─────────────────────────────────────────────┐
│ BUDGET_SETUP / PRIORITY_CHECK               │
│   → Haiku + contexto comprimido             │
└─────────────────────────────────────────────┘
      ↓ si es follow-up pidiendo profundidad
┌─────────────────────────────────────────────┐
│ GENERAL_ANALYSIS con historial              │
│   → Sonnet (verificando límite mensual)     │
│   → Haiku si límite superado (avisa al user)│
└─────────────────────────────────────────────┘
```

El contexto enviado a la IA siempre es comprimido (≈200 tokens):
- 3 líneas de resumen financiero del mes
- Top 5 categorías con % de presupuesto gastado
- Info de cuotas e ingresos
- 3 transacciones recientes relevantes al tema

---

## Modelos usados

| Modelo | ID | Cuándo |
|--------|----|--------|
| Haiku 4.5 | `claude-haiku-4-5-20251001` | Análisis rápido, budget setup, priority check |
| Sonnet 4.6 | `claude-sonnet-4-6` | Follow-ups que piden más profundidad (límite mensual) |
| Sin IA | `none` | Affordability, cuotas y metas con números claros |
