export function getStatusClassName(category?: string): string {
  const k = (category || "").toLowerCase();
  const baseClass = "status-pill";

  if (k === "done") return `${baseClass} ${baseClass}--done`;
  if (k === "indeterminate") return `${baseClass} ${baseClass}--indeterminate`;
  return `${baseClass} ${baseClass}--default`;
}
