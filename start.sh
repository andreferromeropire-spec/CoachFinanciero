#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Iniciando Coach Financiero IA..."

# 1. PostgreSQL
if ! pg_isready -q 2>/dev/null; then
  echo "==> Iniciando PostgreSQL..."
  sudo service postgresql start || sudo pg_ctlcluster 14 main start || true
  sleep 2
fi

# Crear base de datos si no existe
psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='coach_financiero'" \
  | grep -q 1 || psql -U postgres -c "CREATE DATABASE coach_financiero" || true

# 2. Copiar .env si no existen
[ -f "$ROOT/apps/api/.env" ] || cp "$ROOT/apps/api/.env.example" "$ROOT/apps/api/.env"
[ -f "$ROOT/apps/web/.env.local" ] || cp "$ROOT/apps/web/.env.example" "$ROOT/apps/web/.env.local"

# 3. Backend Express (puerto 4000)
echo "==> Iniciando backend en :4000..."
cd "$ROOT/apps/api"
npm run dev &
API_PID=$!

# 4. Frontend Next.js (puerto 3000)
echo "==> Iniciando frontend en :3000..."
cd "$ROOT/apps/web"
npm run dev &
WEB_PID=$!

# 5. Cloudflare Tunnel
echo "==> Iniciando cloudflared tunnel..."
cloudflared tunnel --config "$ROOT/.cloudflared/config.yml" run coachfinanciero &
CF_PID=$!

echo ""
echo "====================================="
echo "  Coach Financiero IA corriendo"
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:4000"
echo "  Health:    http://localhost:4000/api/health"
echo "====================================="
echo "  Presioná Ctrl+C para detener todo"
echo "====================================="

trap "kill $API_PID $WEB_PID $CF_PID 2>/dev/null; exit 0" SIGINT SIGTERM

wait
