ALTER TABLE "PlannedMaintenance"
ADD COLUMN "dueSoonReminderSentAt" TIMESTAMP(3),
ADD COLUMN "dueSoonReminderSentForDate" TEXT;
