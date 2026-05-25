import { getCurrentLocalDayKey } from "./dateOnly";

export function getDueSoonReminderWindowDays() {
  const raw = process.env.PLANNED_MAINTENANCE_DUE_SOON_DAYS?.trim();
  const parsed = raw ? Number(raw) : NaN;

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 7;
  }

  return Math.floor(parsed);
}

export function isDueSoonDayKey(
  dueDayKey: number,
  todayDayKey: number = getCurrentLocalDayKey(),
  windowDays: number = getDueSoonReminderWindowDays()
) {
  return dueDayKey >= todayDayKey && dueDayKey <= todayDayKey + windowDays;
}

export function isOpenMaintenanceStatus(status: string | null, isCompleted: boolean) {
  if (status === "planned") return true;
  if (status === "completed" || status === "cancelled") return false;
  if (status === "inProgress" || status === "waitingForParts") return false;

  return !isCompleted;
}
