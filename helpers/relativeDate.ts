import { Locale } from "@/lib/i18n";

export function relativeDate(iso: string, locale: Locale = "en") {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(locale === "lt" ? "lt-LT" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
