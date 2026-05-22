ALTER TABLE "PlannedMaintenance"
ADD COLUMN "jiraIssueId" TEXT,
ADD COLUMN "jiraIssueKey" TEXT,
ADD COLUMN "jiraIssueUrl" TEXT;

CREATE INDEX "PlannedMaintenance_jiraIssueKey_idx"
ON "PlannedMaintenance"("jiraIssueKey");
