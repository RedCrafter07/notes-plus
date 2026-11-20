/* Page-range text for the PDF import dialog ("1-3, 7"). Pure, so it is unit-tested. */

/**
 * Parses "1-3, 7, 10-" into sorted, unique page numbers within 1..max.
 * Returns `null` for anything it doesn't understand, so the dialog can say
 * so instead of guessing.
 */
export function parsePageRanges(text: string, max: number): number[] | null {
  const pages = new Set<number>();
  const parts = text.split(/[,;\s]+/).filter(Boolean);
  if (parts.length === 0) return null;

  for (const part of parts) {
    const m = /^(\d*)\s*-\s*(\d*)$/.exec(part) ?? /^(\d+)()$/.exec(part);
    if (!m) return null;
    const isRange = part.includes("-");
    const from = m[1] ? Number(m[1]) : 1;
    const to = isRange ? (m[2] ? Number(m[2]) : max) : from;
    if (from < 1 || to > max || from > to) return null;
    for (let n = from; n <= to; n++) pages.add(n);
  }
  return [...pages].sort((a, b) => a - b);
}

/** Formats page numbers back into ranges: [1,2,3,7] -> "1-3, 7". */
export function formatPageRanges(pages: number[]): string {
  const out: string[] = [];
  for (let i = 0; i < pages.length; i++) {
    let j = i;
    while (j + 1 < pages.length && pages[j + 1] === pages[j] + 1) j++;
    out.push(j > i ? `${pages[i]}-${pages[j]}` : `${pages[i]}`);
    i = j;
  }
  return out.join(", ");
}
