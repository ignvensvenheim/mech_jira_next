CREATE TYPE "MaintenanceWorkflowStatus" AS ENUM (
  'planned',
  'inProgress',
  'waitingForParts',
  'completed',
  'cancelled'
);

ALTER TABLE "PlannedMaintenance"
ADD COLUMN "status" "MaintenanceWorkflowStatus" NOT NULL DEFAULT 'planned';

UPDATE "PlannedMaintenance"
SET "status" = CASE
  WHEN "isCompleted" = true THEN 'completed'::"MaintenanceWorkflowStatus"
  ELSE 'planned'::"MaintenanceWorkflowStatus"
END;

CREATE INDEX "PlannedMaintenance_status_idx"
ON "PlannedMaintenance"("status");
