export function fmtDuration(sec: number) {
  if (!sec || sec < 60) return `${Math.max(0, Math.round(sec / 60))}m`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return `${h ? `${h}h ` : ""}${m}m`;
}
