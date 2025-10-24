-- CreateEnum
CREATE TYPE "BatchImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BatchRowStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "password" TEXT,
    "passwordResetRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'customer_service',
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "tax" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "shippingAddress" JSONB,
    "billingAddress" JSONB,
    "notes" TEXT,
    "metadata" JSONB,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "metadata" JSONB,
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT,
    "metadata" JSONB,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "userId" TEXT,
    "actorName" TEXT,
    "actorEmail" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "secretName" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentTypeMapping" (
    "id" TEXT NOT NULL,
    "plannedTypeId" INTEGER NOT NULL,
    "plannedTypeName" TEXT NOT NULL,
    "completedTypeId" INTEGER NOT NULL,
    "completedTypeName" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentTypeMapping_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "ShippingLabel" (
    "id" TEXT NOT NULL,
    "paceShipmentId" INTEGER,
    "paceCartonId" INTEGER,
    "provider" TEXT NOT NULL,
    "providerShipmentId" TEXT,
    "providerLabelId" TEXT,
    "trackingNumber" TEXT NOT NULL,
    "labelUrl" TEXT NOT NULL,
    "labelFormat" TEXT,
    "carrier" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "shipFrom" JSONB NOT NULL,
    "shipTo" JSONB NOT NULL,
    "weight" DECIMAL(10,2),
    "length" DECIMAL(10,2),
    "width" DECIMAL(10,2),
    "height" DECIMAL(10,2),
    "cost" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'active',
    "voidedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "trackingStatus" TEXT,
    "lastTrackedAt" TIMESTAMP(3),
    "isReturnLabel" BOOLEAN NOT NULL DEFAULT false,
    "outboundLabelId" TEXT,
    "rmaNumber" TEXT,
    "metadata" JSONB,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" JSONB,
    "result" JSONB,
    "error" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

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
    "notes" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "lastAttemptAt" TIMESTAMP(3),
    "isTransientError" BOOLEAN NOT NULL DEFAULT false,
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

-- CreateTable
CREATE TABLE "InvoiceIntegration" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" JSONB NOT NULL,
    "netsuiteResponse" JSONB,
    "netsuiteInvoiceId" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentToNetsuiteAt" TIMESTAMP(3),

    CONSTRAINT "InvoiceIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuConfiguration" (
    "id" TEXT NOT NULL,
    "menuKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "icon" TEXT,
    "parentKey" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "visibleToRoles" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_slug_idx" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE INDEX "Membership_tenantId_idx" ON "Membership"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_tenantId_key" ON "Membership"("userId", "tenantId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_tenantId_idx" ON "Order"("tenantId");

-- CreateIndex
CREATE INDEX "Order_orderNumber_idx" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_customerEmail_idx" ON "Order"("customerEmail");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "Attachment_tenantId_idx" ON "Attachment"("tenantId");

-- CreateIndex
CREATE INDEX "Attachment_orderId_idx" ON "Attachment"("orderId");

-- CreateIndex
CREATE INDEX "Attachment_key_idx" ON "Attachment"("key");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Integration_tenantId_idx" ON "Integration"("tenantId");

-- CreateIndex
CREATE INDEX "Integration_provider_idx" ON "Integration"("provider");

-- CreateIndex
CREATE INDEX "Integration_enabled_idx" ON "Integration"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_tenantId_provider_key" ON "Integration"("tenantId", "provider");

-- CreateIndex
CREATE INDEX "ShipmentTypeMapping_tenantId_idx" ON "ShipmentTypeMapping"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentTypeMapping_tenantId_plannedTypeId_key" ON "ShipmentTypeMapping"("tenantId", "plannedTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentTypeMapping_tenantId_completedTypeId_key" ON "ShipmentTypeMapping"("tenantId", "completedTypeId");

-- CreateIndex
CREATE INDEX "CarrierServiceMapping_tenantId_idx" ON "CarrierServiceMapping"("tenantId");

-- CreateIndex
CREATE INDEX "CarrierServiceMapping_shipstationCarrierCode_idx" ON "CarrierServiceMapping"("shipstationCarrierCode");

-- CreateIndex
CREATE INDEX "CarrierServiceMapping_shipstationServiceCode_idx" ON "CarrierServiceMapping"("shipstationServiceCode");

-- CreateIndex
CREATE UNIQUE INDEX "CarrierServiceMapping_tenantId_shipstationCarrierId_shipsta_key" ON "CarrierServiceMapping"("tenantId", "shipstationCarrierId", "shipstationServiceCode");

-- CreateIndex
CREATE INDEX "ShippingLabel_tenantId_idx" ON "ShippingLabel"("tenantId");

-- CreateIndex
CREATE INDEX "ShippingLabel_paceShipmentId_idx" ON "ShippingLabel"("paceShipmentId");

-- CreateIndex
CREATE INDEX "ShippingLabel_paceCartonId_idx" ON "ShippingLabel"("paceCartonId");

-- CreateIndex
CREATE INDEX "ShippingLabel_trackingNumber_idx" ON "ShippingLabel"("trackingNumber");

-- CreateIndex
CREATE INDEX "ShippingLabel_provider_idx" ON "ShippingLabel"("provider");

-- CreateIndex
CREATE INDEX "ShippingLabel_status_idx" ON "ShippingLabel"("status");

-- CreateIndex
CREATE INDEX "ShippingLabel_createdAt_idx" ON "ShippingLabel"("createdAt");

-- CreateIndex
CREATE INDEX "ShippingLabel_isReturnLabel_idx" ON "ShippingLabel"("isReturnLabel");

-- CreateIndex
CREATE INDEX "ShippingLabel_trackingStatus_idx" ON "ShippingLabel"("trackingStatus");

-- CreateIndex
CREATE INDEX "Job_type_idx" ON "Job"("type");

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- CreateIndex
CREATE INDEX "Job_createdAt_idx" ON "Job"("createdAt");

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

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceIntegration_invoiceNumber_key" ON "InvoiceIntegration"("invoiceNumber");

-- CreateIndex
CREATE INDEX "InvoiceIntegration_status_idx" ON "InvoiceIntegration"("status");

-- CreateIndex
CREATE INDEX "InvoiceIntegration_invoiceNumber_idx" ON "InvoiceIntegration"("invoiceNumber");

-- CreateIndex
CREATE INDEX "InvoiceIntegration_createdAt_idx" ON "InvoiceIntegration"("createdAt");

-- CreateIndex
CREATE INDEX "InvoiceIntegration_status_retryCount_idx" ON "InvoiceIntegration"("status", "retryCount");

-- CreateIndex
CREATE INDEX "MenuConfiguration_tenantId_idx" ON "MenuConfiguration"("tenantId");

-- CreateIndex
CREATE INDEX "MenuConfiguration_tenantId_isActive_idx" ON "MenuConfiguration"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "MenuConfiguration_order_idx" ON "MenuConfiguration"("order");

-- CreateIndex
CREATE UNIQUE INDEX "MenuConfiguration_tenantId_menuKey_key" ON "MenuConfiguration"("tenantId", "menuKey");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentTypeMapping" ADD CONSTRAINT "ShipmentTypeMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierServiceMapping" ADD CONSTRAINT "CarrierServiceMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingLabel" ADD CONSTRAINT "ShippingLabel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchImport" ADD CONSTRAINT "BatchImport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchImportRow" ADD CONSTRAINT "BatchImportRow_batchImportId_fkey" FOREIGN KEY ("batchImportId") REFERENCES "BatchImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuConfiguration" ADD CONSTRAINT "MenuConfiguration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
