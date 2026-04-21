-- CreateTable ConnectedEmail
CREATE TABLE IF NOT EXISTS "ConnectedEmail" (
    "id"           TEXT         NOT NULL,
    "userId"       TEXT         NOT NULL,
    "email"        TEXT         NOT NULL,
    "provider"     TEXT         NOT NULL DEFAULT 'google',
    "accessToken"  TEXT         NOT NULL,
    "refreshToken" TEXT,
    "expiresAt"    TIMESTAMP(3),
    "lastImportAt" TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConnectedEmail_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConnectedEmail_userId_email_key"
    ON "ConnectedEmail"("userId", "email");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConnectedEmail_userId_fkey') THEN
    ALTER TABLE "ConnectedEmail"
      ADD CONSTRAINT "ConnectedEmail_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
