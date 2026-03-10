-- CreateTable
CREATE TABLE "EquipmentDetail" (
    "id" TEXT NOT NULL,
    "machineKey" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "EquipmentDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentDetail_machineKey_key" ON "EquipmentDetail"("machineKey");

-- AddForeignKey
ALTER TABLE "EquipmentDetail" ADD CONSTRAINT "EquipmentDetail_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
