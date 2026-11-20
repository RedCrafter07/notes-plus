import type { Layer, Page } from "#lib/tauri/bindings.ts";
import { boundsFromRect, unionBounds, type ContentBounds } from "#lib/util/canvasBounds.ts";
import { blockBounds } from "./blocks";

/*
 * Page sizes in content units. One unit is one CSS pixel at 100% zoom, i.e.
 * 96 units per inch, so paper sizes are mm / 25.4 * 96.
 *
 * Only width/height are stored in the file; the format is recognised from the
 * dimensions. That keeps the file format free of a list that will grow, and a
 * page with odd dimensions (e.g. an imported PDF) simply shows as "Custom".
 */

export interface PageFormat {
  id: string;
  label: string;
  /** Short description shown under the label. */
  hint: string;
  /** Portrait dimensions; `null` for the infinite canvas. */
  size: { width: number; height: number } | null;
  /** Orientation picked when the format is chosen. */
  prefers: Orientation;
}

const mm = (v: number) => Math.round((v / 25.4) * 96);

export const PAGE_FORMATS: PageFormat[] = [
  { id: "a4", label: "A4", hint: "210 × 297 mm", size: { width: mm(210), height: mm(297) }, prefers: "portrait" },
  { id: "a5", label: "A5", hint: "148 × 210 mm", size: { width: mm(148), height: mm(210) }, prefers: "portrait" },
  { id: "letter", label: "Letter", hint: "8.5 × 11 in", size: { width: 816, height: 1056 }, prefers: "portrait" },
  { id: "16:9", label: "16:9", hint: "Slides", size: { width: 1080, height: 1920 }, prefers: "landscape" },
  { id: "4:3", label: "4:3", hint: "Slides", size: { width: 1050, height: 1400 }, prefers: "landscape" },
  { id: "square", label: "Square", hint: "1 : 1", size: { width: 1000, height: 1000 }, prefers: "portrait" },
  { id: "infinite", label: "Infinite", hint: "Endless canvas", size: null, prefers: "portrait" },
];

export type Orientation = "portrait" | "landscape";

export function isInfinite(page: Pick<Page, "width" | "height">) {
  return page.width < 0 || page.height < 0;
}

/** Recognises the format and orientation of a page, or `null` for "Custom". */
export function detectFormat(
  page: Pick<Page, "width" | "height">,
): { format: PageFormat; orientation: Orientation } | null {
  if (isInfinite(page)) {
    return { format: PAGE_FORMATS.find((f) => !f.size)!, orientation: "portrait" };
  }

  for (const format of PAGE_FORMATS) {
    if (!format.size) continue;
    const { width, height } = format.size;
    if (near(page.width, width) && near(page.height, height))
      return { format, orientation: "portrait" };
    if (near(page.width, height) && near(page.height, width))
      return { format, orientation: "landscape" };
  }
  return null;
}

/** Dimensions for a format; infinite is `-1 × -1`. */
export function formatSize(format: PageFormat, orientation: Orientation) {
  if (!format.size) return { width: -1, height: -1 };
  const { width, height } = format.size;
  return orientation === "portrait"
    ? { width, height }
    : { width: height, height: width };
}

/** The page rectangle in content space, or `null` when infinite. */
export function pageRect(page: Pick<Page, "width" | "height">): ContentBounds | null {
  if (isInfinite(page)) return null;
  return boundsFromRect(0, 0, page.width, page.height);
}

/** The box around everything drawn on the given layers. */
export function contentBounds(
  layers: Layer[],
  includeHidden = false,
): ContentBounds | null {
  let acc: ContentBounds | null = null;
  for (const l of layers) {
    if (!includeHidden && !l.visible) continue;
    for (const b of l.blocks) {
      const bounds = blockBounds(b);
      if (bounds) acc = acc ? unionBounds(acc, bounds) : bounds;
    }
  }
  return acc;
}

/** What "the page" means for fitting and export: its rect, or its content. */
export function pageExtent(page: Page): ContentBounds | null {
  return pageRect(page) ?? contentBounds(page.layers);
}

function near(a: number, b: number) {
  return Math.abs(a - b) <= 2;
}
