import type { Page } from "#lib/tauri/bindings.ts";
import { scaleBlock } from "./blocks";
import { isInfinite } from "./pageFormats";

/*
 * "Scale page and content": a page and everything on it made bigger or
 * smaller together, about its top-left corner. Strokes keep their look
 * (widths scale too), text its layout (font size and box width), and the
 * PDF background, which always fills the page, follows by itself. At "fit
 * page" nothing changes on screen; what changes is the scale ink is
 * written at, which is the point: a scan imported several times too large
 * needed pen widths of 40-50, and afterwards takes normal ones.
 */

const ORIGIN = { x: 0, y: 0 };

export function resizePage(page: Page, k: number): Page {
  if (!(k > 0) || k === 1) return page;
  const fixed = !isInfinite(page);
  return {
    ...page,
    width: fixed ? page.width * k : page.width,
    height: fixed ? page.height * k : page.height,
    // Whole units in the file format (u16).
    pattern_scale: Math.max(1, Math.round(page.pattern_scale * k)),
    layers: page.layers.map((l) => ({ ...l, blocks: l.blocks.map((b) => scaleBlock(b, k, ORIGIN)) })),
    // A scaled region no longer has its paper format's size.
    regions: page.regions.map((r) => ({
      ...r,
      x: r.x * k,
      y: r.y * k,
      width: r.width * k,
      height: r.height * k,
      format: "free",
    })),
  };
}

/** The factor that gives the page the short side of `size` (keeping its proportions). */
export function factorFor(page: Pick<Page, "width" | "height">, size: { width: number; height: number }): number {
  return Math.min(size.width, size.height) / Math.min(page.width, page.height);
}
