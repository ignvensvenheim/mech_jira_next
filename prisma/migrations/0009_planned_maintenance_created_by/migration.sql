ALTER TABLE "PlannedMaintenance"
ADD COLUMN "createdById" TEXT;

CREATE INDEX "PlannedMaintenance_createdById_idx"
ON "PlannedMaintenance"("createdById");

ALTER TABLE "PlannedMaintenance"
ADD CONSTRAINT "PlannedMaintenance_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
