-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "machineKey" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT NOT NULL,
    "model" TEXT,
    "serialNumber" TEXT,
    "manufacturer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_machineKey_key" ON "Asset"("machineKey");

-- Backfill assets from existing machine-key based tables and equipment details
INSERT INTO "Asset" (
    "id",
    "machineKey",
    "category",
    "subcategory",
    "createdAt",
    "updatedAt",
    "updatedById"
)
SELECT
    'asset:' || source."machineKey" AS "id",
    source."machineKey",
    split_part(source."machineKey", '::', 1) AS "category",
    split_part(source."machineKey", '::', 2) AS "subcategory",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    source."updatedById"
FROM (
    SELECT "machineKey", "updatedById" FROM "MachineRate"
    UNION
    SELECT "machineKey", NULL::TEXT AS "updatedById" FROM "ManualEntry"
    UNION
    SELECT "machineKey", "updatedById" FROM "TicketFixCost"
    UNION
    SELECT "machineKey", "updatedById" FROM "EquipmentDetail"
) AS source
WHERE source."machineKey" IS NOT NULL
ON CONFLICT ("machineKey") DO NOTHING;

-- Move equipment detail fields into the asset registry
UPDATE "Asset" AS asset
SET
    "model" = details."model",
    "serialNumber" = details."serialNumber",
    "manufacturer" = details."manufacturer",
    "updatedAt" = details."updatedAt",
    "updatedById" = COALESCE(details."updatedById", asset."updatedById")
FROM "EquipmentDetail" AS details
WHERE asset."machineKey" = details."machineKey";

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineRate" ADD CONSTRAINT "MachineRate_machineKey_fkey" FOREIGN KEY ("machineKey") REFERENCES "Asset"("machineKey") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualEntry" ADD CONSTRAINT "ManualEntry_machineKey_fkey" FOREIGN KEY ("machineKey") REFERENCES "Asset"("machineKey") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketFixCost" ADD CONSTRAINT "TicketFixCost_machineKey_fkey" FOREIGN KEY ("machineKey") REFERENCES "Asset"("machineKey") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropTable
DROP TABLE "EquipmentDetail";
