const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

export function parseDateOnly(value: string) {
  const match = DATE_ONLY_PATTERN.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export function formatDateOnly(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";

  return `${date.getUTCFullYear()}-${padDatePart(
    date.getUTCMonth() + 1
  )}-${padDatePart(date.getUTCDate())}`;
}

export function getCurrentLocalDateOnly() {
  const today = new Date();
  return `${today.getFullYear()}-${padDatePart(
    today.getMonth() + 1
  )}-${padDatePart(today.getDate())}`;
}

export function dateOnlyToDayKey(value: string) {
  const date = parseDateOnly(value);
  if (!date) return null;
  return Math.floor(date.getTime() / 86400000);
}

export function getCurrentLocalDayKey() {
  const today = new Date();
  return Math.floor(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000
  );
}
