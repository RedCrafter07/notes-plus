/** A size for display: "4", or "2.5" for a fractional one. */
export function formatSize(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
