import type { ExportRegion, Orientation } from "$lib/tauri/bindings";
import {
  boundsFromRect,
  boundsIntersect,
  type ContentBounds,
} from "$lib/util/canvasBounds";
import { formatSize, PAGE_FORMATS, type PageFormat } from "../pageFormats";

/*
 * An export region is a rectangle on a page that becomes one output page or
 * image, e.g. "this part of my infinite canvas as an A4 page". Regions are
 * stored on their page (`Page.regions`), in export order.
 *
 * With a fixed format the rectangle keeps the format's ratio, so content is
 * never distorted, and its size on the canvas sets the scale (a region twice
 * the size of A4 still exports as A4, with the content at 50%). With "free"
 * the rectangle can have any shape and exports at its own size.
 */

export type { ExportRegion } from "$lib/tauri/bindings";

export const FREE = "free";

type FixedFormat = PageFormat & { size: NonNullable<PageFormat["size"]> };

/** Fixed formats a region can have (every page format except "Infinite"). */
export const FIXED_FORMATS = PAGE_FORMATS.filter((f): f is FixedFormat => f.size !== null);

/** Everything offered in the format picker, "Free" last. */
export const REGION_FORMATS: { id: string; label: string; hint: string }[] = [
  ...FIXED_FORMATS,
  { id: FREE, label: "Free", hint: "Any shape" },
];

export const isFree = (r: Pick<ExportRegion, "format">) => r.format === FREE;

export function formatLabel(r: Pick<ExportRegion, "format">) {
  return REGION_FORMATS.find((f) => f.id === r.format)?.label ?? "A4";
}

function fixedFormat(id: string): FixedFormat {
  return FIXED_FORMATS.find((f) => f.id === id) ?? FIXED_FORMATS[0];
}

/**
 * Output size at 100%, in content units: the format's size for this
 * orientation, or the rectangle itself for a free region.
 */
export function nominalSize(
  r: Pick<ExportRegion, "format" | "orientation" | "width" | "height">,
) {
  return isFree(r)
    ? { width: r.width, height: r.height }
    : formatSize(fixedFormat(r.format), r.orientation);
}

export function regionBounds(r: ExportRegion): ContentBounds {
  return boundsFromRect(r.x, r.y, r.width, r.height);
}

/**
 * Re-shapes a region for a new format/orientation around its centre.
 * Between fixed formats the scale is kept (a 50% A4 becomes a 50% A5);
 * from "free" the width is kept; to "free" the rectangle stays as it is.
 */
export function reshape(
  r: ExportRegion,
  format: string,
  orientation: Orientation,
): ExportRegion {
  if (format === FREE) return { ...r, format, orientation };

  const target = formatSize(fixedFormat(format), orientation);
  const scale = isFree(r) ? r.width / target.width : r.width / nominalSize(r).width;
  const w = target.width * scale;
  const h = target.height * scale;
  return {
    ...r,
    format,
    orientation,
    x: r.x + (r.width - w) / 2,
    y: r.y + (r.height - h) / 2,
    width: w,
    height: h,
  };
}

/** Back to 100%: the format's own size (a free region is always at 100%). */
export function resetScale(r: ExportRegion): ExportRegion {
  const { width, height } = nominalSize(r);
  return { ...r, width, height };
}

const GAP = 40;

/**
 * A new region placed to the right of the last one on the page (copying its
 * format and size), or at the top-left of `anchor` (the sheet or the
 * drawing) as 100% A4 for the first.
 */
export function nextRegion(
  onPage: ExportRegion[],
  anchor: ContentBounds | null,
  number: number,
): ExportRegion {
  const last = onPage.at(-1);
  const base = last ?? {
    format: "a4",
    orientation: "portrait" as const,
    x: anchor?.min.x ?? 0,
    y: anchor?.min.y ?? 0,
    ...formatSize(fixedFormat("a4"), "portrait"),
  };

  return {
    id: crypto.randomUUID(),
    name: `Region ${number}`,
    format: base.format,
    orientation: base.orientation,
    x: last ? last.x + last.width + GAP : base.x,
    y: base.y,
    width: base.width,
    height: base.height,
  };
}

/**
 * Tiles the drawing with regions of one fixed format at 100%, in reading
 * order (rows, then columns), skipping tiles with nothing in them. This turns
 * an infinite canvas into printable pages in one step.
 */
export function coverContent(
  content: ContentBounds,
  blocks: ContentBounds[],
  format: string,
  orientation: Orientation,
  firstNumber = 1,
): ExportRegion[] {
  const fmt = format === FREE ? "a4" : format;
  const { width, height } = formatSize(fixedFormat(fmt), orientation);
  const cols = Math.max(1, Math.ceil(content.width / width));
  const rows = Math.max(1, Math.ceil(content.height / height));
  // Centre the grid on the content so the margins are even.
  const x0 = content.min.x - (cols * width - content.width) / 2;
  const y0 = content.min.y - (rows * height - content.height) / 2;

  const out: ExportRegion[] = [];
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const tile = boundsFromRect(x0 + col * width, y0 + row * height, width, height);
      if (!blocks.some((b) => boundsIntersect(b, tile))) continue;
      out.push({
        id: crypto.randomUUID(),
        name: `Region ${firstNumber + out.length}`,
        format: fmt,
        orientation,
        x: tile.min.x,
        y: tile.min.y,
        width,
        height,
      });
    }
  return out;
}

/** Moves the item at `from` to `to` (clamped), returning a new array. */
export function move<T>(list: T[], from: number, to: number): T[] {
  const target = Math.max(0, Math.min(list.length - 1, to));
  if (from === target) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}
