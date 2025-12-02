export function relativeDate(iso: string) {
  const d = new Date(iso);

  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");

  return `${hh}:${mm} ${month}/${day}`;
}
