-- Migración correctiva: crea todo lo que puede faltar con IF NOT EXISTS

-- Tabla User con columna status
CREATE TABLE IF NOT EXISTS "User" (
    "id"        TEXT         NOT NULL,
    "email"     TEXT         NOT NULL,
    "password"  TEXT         NOT NULL,
    "name"      TEXT,
    "isAdmin"   BOOLEAN      NOT NULL DEFAULT false,
    "status"    TEXT         NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- Columnas userId en todas las tablas relacionadas
ALTER TABLE "Account"      ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL DEFAULT 'default-user';
ALTER TABLE "Transaction"  ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL DEFAULT 'default-user';
ALTER TABLE "Budget"       ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL DEFAULT 'default-user';
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL DEFAULT 'default-user';
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL DEFAULT 'default-user';
ALTER TABLE "EmailIngest"  ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL DEFAULT 'default-user';
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL DEFAULT 'default-user';
ALTER TABLE "EmailIngest"  ADD COLUMN IF NOT EXISTS "messageId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "EmailIngest_messageId_key" ON "EmailIngest"("messageId") WHERE "messageId" IS NOT NULL;

-- Usuario admin por defecto (contraseña: Coach2024!)
-- El seed posterior puede cambiarla con las credenciales reales
INSERT INTO "User" ("id", "email", "password", "name", "isAdmin", "status", "createdAt")
VALUES (
    'default-user',
    'admin@coachfinanciero.local',
    '$2a$12$tPuEYrZqu94.Ot5ofqoxkukKoIya8PsBpjzrlN6E.kxthf/4FPIki',
    'Admin',
    true,
    'active',
    NOW()
) ON CONFLICT ("id") DO NOTHING;

-- FK constraints (solo si no existen)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Account_userId_fkey') THEN
        ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Transaction_userId_fkey') THEN
        ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Budget_userId_fkey') THEN
        ALTER TABLE "Budget" ADD CONSTRAINT "Budget_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Conversation_userId_fkey') THEN
        ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_userId_fkey') THEN
        ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmailIngest_userId_fkey') THEN
        ALTER TABLE "EmailIngest" ADD CONSTRAINT "EmailIngest_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserSettings_userId_fkey') THEN
        ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
