-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "buyBlue" DECIMAL(10,2) NOT NULL,
    "sellBlue" DECIMAL(10,2) NOT NULL,
    "buyOfficial" DECIMAL(10,2) NOT NULL,
    "sellOfficial" DECIMAL(10,2) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'bluelytics',

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExchangeRate_date_idx" ON "ExchangeRate"("date");

-- CreateIndex
CREATE INDEX "ExchangeRate_currency_date_idx" ON "ExchangeRate"("currency", "date");
