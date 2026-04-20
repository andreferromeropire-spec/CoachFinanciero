-- AlterTable: agregar columna status a User (IF NOT EXISTS evita error si ya existe)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
