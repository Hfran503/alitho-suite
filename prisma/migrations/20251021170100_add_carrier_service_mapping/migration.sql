-- CreateTable
CREATE TABLE "CarrierServiceMapping" (
    "id" TEXT NOT NULL,
    "shipstationCarrierId" TEXT NOT NULL,
    "shipstationCarrierCode" TEXT NOT NULL,
    "shipstationServiceCode" TEXT NOT NULL,
    "carrierName" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "paceShipViaId" INTEGER NOT NULL,
    "paceShipViaName" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarrierServiceMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CarrierServiceMapping_tenantId_idx" ON "CarrierServiceMapping"("tenantId");

-- CreateIndex
CREATE INDEX "CarrierServiceMapping_shipstationCarrierCode_idx" ON "CarrierServiceMapping"("shipstationCarrierCode");

-- CreateIndex
CREATE INDEX "CarrierServiceMapping_shipstationServiceCode_idx" ON "CarrierServiceMapping"("shipstationServiceCode");

-- CreateIndex
CREATE UNIQUE INDEX "CarrierServiceMapping_tenantId_shipstationCarrierId_shipstationServiceCode_key" ON "CarrierServiceMapping"("tenantId", "shipstationCarrierId", "shipstationServiceCode");

-- AddForeignKey
ALTER TABLE "CarrierServiceMapping" ADD CONSTRAINT "CarrierServiceMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
