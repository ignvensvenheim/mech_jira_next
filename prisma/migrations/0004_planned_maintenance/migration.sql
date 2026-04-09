-- CreateTable
CREATE TABLE "PlannedMaintenance" (
    "id" TEXT NOT NULL,
    "machineKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlannedMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlannedMaintenance_machineKey_idx" ON "PlannedMaintenance"("machineKey");

-- CreateIndex
CREATE INDEX "PlannedMaintenance_dueDate_idx" ON "PlannedMaintenance"("dueDate");

-- CreateIndex
CREATE INDEX "PlannedMaintenance_isCompleted_idx" ON "PlannedMaintenance"("isCompleted");

-- AddForeignKey
ALTER TABLE "PlannedMaintenance" ADD CONSTRAINT "PlannedMaintenance_machineKey_fkey" FOREIGN KEY ("machineKey") REFERENCES "Asset"("machineKey") ON DELETE RESTRICT ON UPDATE CASCADE;
