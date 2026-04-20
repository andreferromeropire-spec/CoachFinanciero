-- Agrega la columna status si no existe (idempotente)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';

-- Limpia el registro fallido para que prisma migrate deploy lo re-aplique limpio
DELETE FROM "_prisma_migrations"
WHERE migration_name = '20260420000001_add_user_status'
  AND finished_at IS NULL;
