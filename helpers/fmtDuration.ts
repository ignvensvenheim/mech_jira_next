import { Locale } from "@/lib/i18n";

export function fmtDuration(sec: number, locale: Locale = "en") {
  const minuteUnit = locale === "lt" ? "min" : "m";
  const hourUnit = locale === "lt" ? "val" : "h";

  if (!sec || sec < 60) return `${Math.max(0, Math.round(sec / 60))}${minuteUnit}`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return `${h ? `${h}${hourUnit} ` : ""}${m}${minuteUnit}`;
}
