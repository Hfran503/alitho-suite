-- AlterTable
-- Make paceShipmentId optional to support manual labels
ALTER TABLE "ShippingLabel" ALTER COLUMN "paceShipmentId" DROP NOT NULL;
