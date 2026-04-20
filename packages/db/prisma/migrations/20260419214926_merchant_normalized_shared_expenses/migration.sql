-- CreateEnum
CREATE TYPE "SharedStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'SETTLED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SHARED_EXPENSE';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "isShared" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "merchantNormalized" TEXT,
ADD COLUMN     "sharedStatus" "SharedStatus" NOT NULL DEFAULT 'SETTLED',
ADD COLUMN     "sharedWith" INTEGER,
ADD COLUMN     "yourShare" DECIMAL(15,2);
