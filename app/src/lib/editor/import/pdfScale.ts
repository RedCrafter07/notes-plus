/*
 * Right-sizing scanned PDFs. A PDF page's size is in points (1/72 inch) and
 * is imported 1:1, so an A4 page becomes an A4 page. Many scanners write the
 * page size as the image's pixel count at 72 dpi instead, so a 300 dpi A4
 * scan claims to be 2480 x 3508 pt (4.2x too large) and ink and pen presets
 * look tiny on it.
 *
 * `detectScan` recognises that exactly: the page has the proportions of a
 * known paper size and is that size times a common scan resolution / 72.
 * The factor back to the real paper then follows, and pages that are fine
 * are not touched. Other oversized pages can still be matched to the note.
 *
 * A-series papers all have the same shape, so the pixel count alone cannot
 * tell A4 at 300 dpi from A6 at 600 dpi (or A3 at 300 from A5 at 600). The
 * combinations are therefore tried from the most likely (A4, then Letter;
 * 300 dpi, then 200) and the first that fits wins.
 */

const mmToPt = (mm: number) => (mm / 25.4) * 72;

/** Portrait paper sizes in points, most likely first. */
const PAPERS: { label: string; width: number; height: number }[] = [
  { label: "A4", width: mmToPt(210), height: mmToPt(297) },
  { label: "Letter", width: 612, height: 792 },
  { label: "A5", width: mmToPt(148), height: mmToPt(210) },
  { label: "Legal", width: 612, height: 1008 },
  { label: "A3", width: mmToPt(297), height: mmToPt(420) },
  { label: "B5", width: mmToPt(176), height: mmToPt(250) },
  { label: "A6", width: mmToPt(105), height: mmToPt(148) },
];

/** Resolutions scanners commonly use, most likely first. */
const SCAN_DPI = [300, 200, 150, 600, 400, 240, 100, 1200];
/** Proportions must match this closely (relative). */
const RATIO_TOLERANCE = 0.01;
/** ...and the size this closely (relative), allowing for cropped margins. */
const SIZE_TOLERANCE = 0.025;
/** A page whose longer side exceeds this (pt) is oversized even if not recognised: A3 plus a margin. */
const OVERSIZED = mmToPt(420) * 1.15;

export interface ScanInfo {
  /** The paper it was scanned from, e.g. "A4". */
  paper: string;
  dpi: number;
  /** Scale from the stored size to the real one (below 1). */
  factor: number;
}

/** A page stored at its scan resolution, and the paper it really is; undefined for a normal page. */
export function detectScan(widthPt: number, heightPt: number): ScanInfo | undefined {
  const short = Math.min(widthPt, heightPt);
  const long = Math.max(widthPt, heightPt);
  if (short <= 0) return;
  const fits = (p: (typeof PAPERS)[number], dpi: number) =>
    Math.abs(short / long - p.width / p.height) <= RATIO_TOLERANCE * (p.width / p.height) &&
    Math.abs(long - (p.height * dpi) / 72) <= SIZE_TOLERANCE * ((p.height * dpi) / 72);
  // Already a real paper size: nothing to fix.
  if (PAPERS.some((p) => fits(p, 72))) return;
  for (const p of PAPERS)
    for (const dpi of SCAN_DPI) if (fits(p, dpi)) return { paper: p.label, dpi, factor: p.height / long };
}

/** Whether a page is far larger than paper, scanned or not. */
export function isOversized(widthPt: number, heightPt: number): boolean {
  return !!detectScan(widthPt, heightPt) || Math.max(widthPt, heightPt) > OVERSIZED;
}

/** How imported pages are sized. */
export type PdfSizing =
  /** Each page as it is stored. */
  | { kind: "keep" }
  /** Scans at their real paper size; other pages as they are. */
  | { kind: "real" }
  /** Each page as wide as `width` (content units), e.g. the note's pages. */
  | { kind: "match"; width: number }
  | { kind: "custom"; percent: number };

/** PDF points are 1/72 inch; content units are 1/96 inch. */
export const PT_TO_UNITS = 96 / 72;

/** Factor applied to a page's stored size (in points) on import. */
export function sizeFactor(sizing: PdfSizing, widthPt: number, heightPt: number): number {
  switch (sizing.kind) {
    case "keep":
      return 1;
    case "real":
      return detectScan(widthPt, heightPt)?.factor ?? 1;
    case "match":
      return widthPt > 0 ? sizing.width / (widthPt * PT_TO_UNITS) : 1;
    case "custom":
      return sizing.percent > 0 ? sizing.percent / 100 : 1;
  }
}
