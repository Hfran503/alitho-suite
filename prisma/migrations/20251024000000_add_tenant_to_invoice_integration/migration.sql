-- AlterTable
-- Add tenantId to InvoiceIntegration
-- For existing records, set tenantId to the first available tenant
-- This is safe since most deployments have only one tenant

-- First, add the column as nullable
ALTER TABLE "InvoiceIntegration" ADD COLUMN "tenantId" TEXT;

-- Set tenantId for existing records to the first tenant
UPDATE "InvoiceIntegration"
SET "tenantId" = (SELECT "id" FROM "Tenant" LIMIT 1)
WHERE "tenantId" IS NULL;

-- Now make it NOT NULL
ALTER TABLE "InvoiceIntegration" ALTER COLUMN "tenantId" SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE "InvoiceIntegration" ADD CONSTRAINT "InvoiceIntegration_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create index for better query performance
CREATE INDEX "InvoiceIntegration_tenantId_idx" ON "InvoiceIntegration"("tenantId");
