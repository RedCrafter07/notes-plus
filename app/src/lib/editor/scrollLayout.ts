import type { Page } from "#lib/tauri/bindings.ts";
import type { Point2D } from "#lib/util/canvasBounds.ts";

/*
 * Scroll mode lays the pages out in a column, one below the other, centred
 * on a common axis with a gap between them. Only the current page is
 * edited and drawn live; it keeps its own coordinates, and every other
 * page sits at an offset from it (`offsetFrom`). Scrolling far enough onto
 * another page makes that one current, and the view shifts by the same
 * offset, so nothing moves on screen.
 *
 * Infinite pages have no height to stack, so a note with one cannot scroll.
 */

/** Space between pages in the column, in content units. */
export const PAGE_GAP = 32;

/** A page's place in the column: its top-left corner and size. */
export interface Slot {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Size = Pick<Page, "width" | "height">;

/** The column, or null if a page is infinite (then the note cannot scroll). */
export function columnLayout(pages: Size[]): Slot[] | null {
  const slots: Slot[] = [];
  let y = 0;
  for (const p of pages) {
    if (!(p.width > 0 && p.height > 0)) return null;
    slots.push({ x: -p.width / 2, y, width: p.width, height: p.height });
    y += p.height + PAGE_GAP;
  }
  return slots;
}

/** Where page `j`'s top-left corner is, in page `cur`'s coordinates. */
export function offsetFrom(slots: Slot[], cur: number, j: number): Point2D {
  return { x: slots[j].x - slots[cur].x, y: slots[j].y - slots[cur].y };
}

/**
 * The page whose part of the column `y` (in page `cur`'s coordinates) is
 * in: each page owns its height plus half of the gaps around it.
 */
export function pageAtY(slots: Slot[], cur: number, y: number): number {
  const col = y + slots[cur].y;
  for (let i = 0; i < slots.length - 1; i++) if (col < slots[i].y + slots[i].height + PAGE_GAP / 2) return i;
  return slots.length - 1;
}

/** The page under point `p` (in page `cur`'s coordinates), or undefined if it is in a gap or beside the column. */
export function pageAtPoint(slots: Slot[], cur: number, p: Point2D): number | undefined {
  const x = p.x + slots[cur].x;
  const y = p.y + slots[cur].y;
  const i = slots.findIndex((s) => x >= s.x && x <= s.x + s.width && y >= s.y && y <= s.y + s.height);
  return i === -1 ? undefined : i;
}

/** The whole column's extent in page `cur`'s coordinates. */
export function columnBounds(slots: Slot[], cur: number) {
  const o = slots[cur];
  const left = Math.min(...slots.map((s) => s.x)) - o.x;
  const right = Math.max(...slots.map((s) => s.x + s.width)) - o.x;
  const last = slots[slots.length - 1];
  return { left, right, top: slots[0].y - o.y, bottom: last.y + last.height - o.y };
}
