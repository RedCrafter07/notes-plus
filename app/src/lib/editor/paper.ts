import type { BackgroundPattern, Page } from "#lib/tauri/bindings.ts";

/*
 * Paper patterns, described once for the four places that draw them: the
 * editor (Paper.svelte, SVG), canvas renders (draw.ts: export, thumbnails,
 * presenter), SVG export (render/svg.ts) and the previews in Page setup
 * (BackgroundPatterns.svelte).
 *
 * `s` is `Page.pattern_scale`, the ruling's spacing. Most patterns repeat
 * as a tile; Cornell and Margin are the ruled tile plus guide lines placed
 * relative to the page (`paperGuides`), which an infinite page does not
 * have.
 */

export const SQRT3 = Math.sqrt(3);

/** The repeating part of a pattern: horizontal rules, lines and dots, in tile units. */
export interface PaperTile {
  width: number;
  height: number;
  /** y of full-width horizontal rules. */
  rules: number[];
  /** Vertical rules (x), full height. */
  columns: number[];
  /**
   * One period of slanted lines, running past the tile vertically. A
   * canvas draws each tile's part between its top and bottom (`lineBand`);
   * an SVG pattern clips at the tile, so it also draws the copies one and
   * two tiles to either side (`lineCopies`), which continue them.
   */
  lines: [number, number, number, number][];
  /** Dots at the tile's corner (an SVG pattern draws all four corners). */
  dots: [number, number][];
}

/** A line's part between y = top and y = bottom. */
export function lineBand([x1, y1, x2, y2]: PaperTile["lines"][number], top: number, bottom: number) {
  const at = (y: number) => x1 + ((y - y1) * (x2 - x1)) / (y2 - y1);
  return [at(top), top, at(bottom), bottom] as const;
}

/** The tile's lines with their copies shifted by -2..2 tile widths (for SVG patterns). */
export function lineCopies(t: PaperTile): PaperTile["lines"] {
  return [-2, -1, 0, 1, 2].flatMap((k) =>
    t.lines.map(([x1, y1, x2, y2]) => [x1 + k * t.width, y1, x2 + k * t.width, y2] as PaperTile["lines"][number]),
  );
}

/** Where to draw a dot in an SVG pattern: every corner, since the tile clips it. */
export function dotCopies(t: PaperTile): [number, number][] {
  return t.dots.flatMap(([x, y]) => [
    [x, y],
    [x + t.width, y],
    [x, y + t.height],
    [x + t.width, y + t.height],
  ]);
}

/** Ruled patterns are drawn as lines plus guides. */
const RULED: BackgroundPattern[] = ["Lines", "Cornell", "Margin"];

export function paperTile(pattern: BackgroundPattern | null, s: number): PaperTile | null {
  if (!pattern || s <= 0) return null;
  const tile = (width: number, height: number, t: Partial<PaperTile>): PaperTile => ({
    width,
    height,
    rules: [],
    columns: [],
    lines: [],
    dots: [],
    ...t,
  });
  if (RULED.includes(pattern)) return tile(s, s, { rules: [0] });
  switch (pattern) {
    case "Squares":
      return tile(s, s, { rules: [0], columns: [0] });
    case "Dots":
      return tile(s, s, { dots: [[0, 0]] });
    case "Staff": {
      // A staff of five lines s/3 apart, then a gap: one staff every 4s.
      const gap = s / 3;
      return tile(s, 4 * s, { rules: [0, 1, 2, 3, 4].map((i) => s + i * gap) });
    }
    case "Isometric": {
      // A triangle grid of side s: rules every h/2, and lines at ±60° through
      // the lattice points, which sit at (k s, h/4) and (k s + s/2, 3h/4).
      const h = s * SQRT3;
      // Through (0, h/4), from y = -h to y = 2h.
      const up = (h + h / 4) / SQRT3;
      const down = (2 * h - h / 4) / SQRT3;
      const lines: PaperTile["lines"] = [
        [-up, -h, down, 2 * h],
        [up, -h, -down, 2 * h],
      ];
      return tile(s, h, { rules: [h / 4, (3 * h) / 4], lines });
    }
    default:
      return null;
  }
}

/** A line placed relative to the page. */
export interface PaperGuide {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** null: the page's pattern colour. */
  color: string | null;
  /** Line width, in multiples of the ruling's. */
  weight: number;
}

/** The red of a margin line. */
export const MARGIN_RED = "#e5848e";

/** Guide lines of a page's pattern (Cornell, Margin); none on an infinite page. */
export function paperGuides(page: Pick<Page, "pattern" | "width" | "height">): PaperGuide[] {
  const { width: w, height: h } = page;
  if (!(w > 0 && h > 0)) return [];
  switch (page.pattern) {
    case "Margin": {
      const x = Math.round(w * 0.12);
      return [{ x1: x, y1: 0, x2: x, y2: h, color: MARGIN_RED, weight: 1.5 }];
    }
    case "Cornell": {
      const x = Math.round(w * 0.3);
      const y = Math.round(h * 0.8);
      return [
        // Heavier than the ruling, or the summary line is lost among it.
        { x1: x, y1: 0, x2: x, y2: y, color: null, weight: 3 },
        { x1: 0, y1: y, x2: w, y2: y, color: null, weight: 3 },
      ];
    }
    default:
      return [];
  }
}
