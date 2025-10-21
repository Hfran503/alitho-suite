-- CreateEnum
CREATE TYPE "BatchImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BatchRowStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "BatchImport" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT,
    "sheetName" TEXT,
    "status" "BatchImportStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "successfulRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "carrierId" TEXT,
    "carrierCode" TEXT,
    "serviceCode" TEXT,
    "carrier" TEXT,
    "service" TEXT,
    "billToParty" TEXT NOT NULL DEFAULT 'sender',
    "billToAccount" TEXT,
    "billToCountryCode" TEXT NOT NULL DEFAULT 'US',
    "billToPostalCode" TEXT,
    "containsAlcohol" BOOLEAN NOT NULL DEFAULT false,
    "saturdayDelivery" BOOLEAN NOT NULL DEFAULT false,
    "confirmation" TEXT NOT NULL DEFAULT 'none',
    "notificationsEmail" TEXT,
    "fromAddress" JSONB,
    "columnMapping" JSONB,
    "tenantId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BatchImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchImportRow" (
    "id" TEXT NOT NULL,
    "batchImportId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "status" "BatchRowStatus" NOT NULL DEFAULT 'PENDING',
    "groupKey" TEXT,
    "shipDate" TIMESTAMP(3),
    "jobNumber" TEXT,
    "totalPackages" INTEGER,
    "packageNumber" INTEGER,
    "shipToName" TEXT,
    "shipToCompany" TEXT,
    "shipToAddress1" TEXT,
    "shipToAddress2" TEXT,
    "shipToCity" TEXT,
    "shipToState" TEXT,
    "shipToZip" TEXT,
    "shipToCountry" TEXT NOT NULL DEFAULT 'US',
    "shipToPhone" TEXT,
    "weight" DOUBLE PRECISION,
    "length" DOUBLE PRECISION,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "reference1" TEXT,
    "reference2" TEXT,
    "reference3" TEXT,
    "itemNumber" TEXT,
    "itemQuantity" INTEGER,
    "trackingNumber" TEXT,
    "trackingUrl" TEXT,
    "labelUrl" TEXT,
    "shippingCost" DOUBLE PRECISION,
    "errorMessage" TEXT,
    "paceJobShipmentId" INTEGER,
    "paceCartonId" INTEGER,
    "shipstationShipmentId" TEXT,
    "shipstationLabelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "BatchImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchImportMapping" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "tenantId" TEXT,
    "mappingName" TEXT NOT NULL,
    "columnMappings" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BatchImportMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BatchImport_tenantId_idx" ON "BatchImport"("tenantId");

-- CreateIndex
CREATE INDEX "BatchImport_status_idx" ON "BatchImport"("status");

-- CreateIndex
CREATE INDEX "BatchImport_createdAt_idx" ON "BatchImport"("createdAt");

-- CreateIndex
CREATE INDEX "BatchImportRow_batchImportId_idx" ON "BatchImportRow"("batchImportId");

-- CreateIndex
CREATE INDEX "BatchImportRow_batchImportId_status_idx" ON "BatchImportRow"("batchImportId", "status");

-- CreateIndex
CREATE INDEX "BatchImportRow_groupKey_idx" ON "BatchImportRow"("groupKey");

-- CreateIndex
CREATE INDEX "BatchImportRow_jobNumber_idx" ON "BatchImportRow"("jobNumber");

-- CreateIndex
CREATE INDEX "BatchImportRow_status_idx" ON "BatchImportRow"("status");

-- CreateIndex
CREATE INDEX "BatchImportMapping_userId_idx" ON "BatchImportMapping"("userId");

-- CreateIndex
CREATE INDEX "BatchImportMapping_tenantId_idx" ON "BatchImportMapping"("tenantId");

-- AddForeignKey
ALTER TABLE "BatchImport" ADD CONSTRAINT "BatchImport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchImportRow" ADD CONSTRAINT "BatchImportRow_batchImportId_fkey" FOREIGN KEY ("batchImportId") REFERENCES "BatchImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
