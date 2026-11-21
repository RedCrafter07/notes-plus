import type { Block, Page, Point } from "#lib/tauri/bindings.ts";
import {
  boundsIntersect,
  getStrokeBounds,
  type ContentBounds,
  type Point2D,
} from "#lib/util/canvasBounds.ts";
import { isPointInPolygon } from "#lib/util/geometry.ts";
import { prunePaths } from "./render/strokes";
import { layoutText } from "./text";

/*
 * Every block-type-specific decision lives here, behind an exhaustive
 * `switch (b.type)`. Adding a variant to `Block` in Rust makes each of these
 * fail to compile (via `assertNever`) until it is handled, instead of
 * silently falling through somewhere in the editor.
 *
 * Invariant (relied on by history and the render caches): blocks are never
 * mutated in place. Every content change returns a new block with a new id.
 */

export type StrokeBlock = Extract<Block, { type: "Stroke" }>;
export type TextBlock = Extract<Block, { type: "Text" }>;
export type ImageBlock = Extract<Block, { type: "Image" }>;

export function assertNever(x: never): never {
  throw new Error(`Unhandled block: ${JSON.stringify(x)}`);
}

export const isStroke = (b: Block): b is StrokeBlock => b.type === "Stroke";

export function newId() {
  return crypto.randomUUID();
}

// Bounds by block id. Safe because a block's content never changes under the
// same id. Hit by culling on every frame and by the eraser on every move.
const boundsCache = new Map<string, ContentBounds | null>();

/** Axis-aligned bounds in content space, or `null` for an empty block. */
export function blockBounds(b: Block): ContentBounds | null {
  let r = boundsCache.get(b.id);
  if (r === undefined) {
    r = computeBounds(b);
    boundsCache.set(b.id, r);
  }
  return r;
}

/** Forgets cached geometry for every block id not in `live`. */
export function pruneBlockCaches(live: Set<string>) {
  for (const id of boundsCache.keys()) if (!live.has(id)) boundsCache.delete(id);
  prunePaths(live);
}

/** Forgets cached text bounds, e.g. once the real font has loaded. */
export function clearTextBounds() {
  boundsCache.clear();
}

/** The attachment a block shows, if any (a key into `NoteData.assets`). */
export function blockAsset(b: Block): string | null {
  switch (b.type) {
    case "Image":
      return b.asset;
    case "Stroke":
    case "Text":
      return null;
    default:
      return assertNever(b);
  }
}

/**
 * Every attachment the pages refer to: PDF backgrounds and image blocks.
 * Mirrors `NoteData::used_assets` in Rust, which decides what a save keeps.
 */
export function usedAssets(pages: Page[]): Set<string> {
  const used = new Set<string>();
  for (const page of pages) {
    if (page.background_asset) used.add(page.background_asset);
    for (const layer of page.layers)
      for (const b of layer.blocks) {
        const a = blockAsset(b);
        if (a) used.add(a);
      }
  }
  return used;
}

function computeBounds(b: Block): ContentBounds | null {
  switch (b.type) {
    case "Stroke":
      return getStrokeBounds(b);
    case "Text": {
      const { height } = layoutText(b.text, b.width, b.font_size);
      return rect(b.x, b.y, b.width, height);
    }
    case "Image":
      return rect(b.x, b.y, b.width, b.height);
    default:
      return assertNever(b);
  }
}

/** Returns a moved copy with a fresh id. */
export function translateBlock(b: Block, dx: number, dy: number): Block {
  switch (b.type) {
    case "Stroke":
      return {
        ...b,
        id: newId(),
        points: b.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
      };
    case "Text":
    case "Image":
      return { ...b, id: newId(), x: b.x + dx, y: b.y + dy };
    default:
      return assertNever(b);
  }
}

/** A deep-enough copy with a fresh id, for duplicate/paste. */
export function cloneBlock(b: Block): Block {
  return translateBlock(b, 0, 0);
}

/** The block's colour, or `null` if it has none (images). */
export function blockColor(b: Block): string | null {
  switch (b.type) {
    case "Stroke":
    case "Text":
      return b.color;
    case "Image":
      return null;
    default:
      return assertNever(b);
  }
}

/** Returns a recoloured copy, or the same block if colour does not apply. */
export function recolorBlock(b: Block, color: string): Block {
  switch (b.type) {
    case "Stroke":
    case "Text":
      return b.color === color ? b : { ...b, id: newId(), color };
    case "Image":
      return b;
    default:
      return assertNever(b);
  }
}

/** Whether a closed lasso polygon selects this block. */
export function blockInPolygon(b: Block, polygon: Point[]): boolean {
  switch (b.type) {
    case "Stroke":
      return b.points.some((p) => isPointInPolygon(p, polygon));
    case "Text":
    case "Image": {
      // Selected if any corner or the centre is inside the lasso.
      const bounds = blockBounds(b);
      if (!bounds) return false;
      const { min, max } = bounds;
      const probes: Point2D[] = [
        min,
        max,
        { x: min.x, y: max.y },
        { x: max.x, y: min.y },
        { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2 },
      ];
      return probes.some((p) => isPointInPolygon(p, polygon));
    }
    default:
      return assertNever(b);
  }
}

/** Whether the block is (at least partly) inside a visible rect. */
export function blockVisibleIn(b: Block, view: ContentBounds): boolean {
  const bounds = blockBounds(b);
  return !!bounds && boundsIntersect(bounds, view);
}

function rect(x: number, y: number, w: number, h: number): ContentBounds {
  return {
    min: { x, y },
    max: { x: x + w, y: y + h },
    width: w,
    height: h,
  };
}
