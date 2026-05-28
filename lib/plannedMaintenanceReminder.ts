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

export function isMaintenanceReminderEligible(isCompleted: boolean) {
  return !isCompleted;
}
