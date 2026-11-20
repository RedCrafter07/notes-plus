import {
  boundsFromRect,
  boundsIntersect,
  type ContentBounds,
} from "$lib/util/canvasBounds";
import {
  formatSize,
  PAGE_FORMATS,
  type Orientation,
  type PageFormat,
} from "../pageFormats";

/*
 * An export region is a rectangle on one page that becomes one output page or
 * image, e.g. "this part of my infinite canvas as an A4 page". Its aspect
 * ratio always matches its format, so content is never distorted; its size
 * on the canvas sets how much content it covers (bigger = smaller on paper).
 */

export interface ExportRegion {
  id: string;
  name: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  formatId: string;
  orientation: Orientation;
}

/** Formats a region can have (everything except "Infinite"). */
export const REGION_FORMATS = PAGE_FORMATS.filter(
  (f): f is PageFormat & { size: NonNullable<PageFormat["size"]> } => f.size !== null,
);

export function regionFormat(r: Pick<ExportRegion, "formatId">) {
  return REGION_FORMATS.find((f) => f.id === r.formatId) ?? REGION_FORMATS[0];
}

/** The format's size in content units at 100%, for this orientation. */
export function nominalSize(r: Pick<ExportRegion, "formatId" | "orientation">) {
  return formatSize(regionFormat(r), r.orientation);
}

export function regionBounds(r: ExportRegion): ContentBounds {
  return boundsFromRect(r.x, r.y, r.width, r.height);
}

/** Re-shapes a region for a new format/orientation, keeping its centre and width. */
export function reshape(
  r: ExportRegion,
  formatId: string,
  orientation: Orientation,
): ExportRegion {
  const { width, height } = formatSize(regionFormat({ formatId }), orientation);
  const scale = r.width / nominalSize(r).width;
  const w = width * scale;
  const h = height * scale;
  return {
    ...r,
    formatId,
    orientation,
    x: r.x + (r.width - w) / 2,
    y: r.y + (r.height - h) / 2,
    width: w,
    height: h,
  };
}

const GAP = 40;

/**
 * A new region at 100% of its format, placed to the right of the last one,
 * or at the top-left of `anchor` (the page or its content) for the first.
 */
export function nextRegion(
  existing: ExportRegion[],
  pageIndex: number,
  anchor: ContentBounds | null,
  formatId = "a4",
  orientation: Orientation = "portrait",
): ExportRegion {
  const onPage = existing.filter((r) => r.pageIndex === pageIndex);
  const last = onPage.at(-1);
  const fmt = last ? { formatId: last.formatId, orientation: last.orientation } : { formatId, orientation };
  const { width, height } = last ? { width: last.width, height: last.height } : nominalSize(fmt);

  return {
    id: crypto.randomUUID(),
    name: `Region ${existing.length + 1}`,
    pageIndex,
    ...fmt,
    x: last ? last.x + last.width + GAP : (anchor?.min.x ?? 0),
    y: last ? last.y : (anchor?.min.y ?? 0),
    width,
    height,
  };
}

/**
 * Tiles the content with regions of one format at 100%, in reading order
 * (rows, then columns), skipping tiles with nothing in them. This turns an
 * infinite canvas into printable pages in one step.
 */
export function coverContent(
  content: ContentBounds,
  blocks: ContentBounds[],
  pageIndex: number,
  formatId: string,
  orientation: Orientation,
  firstNumber = 1,
): ExportRegion[] {
  const { width, height } = formatSize(regionFormat({ formatId }), orientation);
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
        pageIndex,
        formatId,
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
