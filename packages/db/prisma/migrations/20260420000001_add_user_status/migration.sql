-- AlterTable: agregar columna status a User si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'status'
  ) THEN
    ALTER TABLE "User" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
  END IF;
END $$;

-- Actualizar registros existentes sin status
UPDATE "User" SET "status" = 'active' WHERE "status" IS NULL;
