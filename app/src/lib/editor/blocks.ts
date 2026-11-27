import type { Block, Page, Point } from "#lib/tauri/bindings.ts";
import {
  boundsIntersect,
  getStrokeBounds,
  type ContentBounds,
  type Point2D,
} from "#lib/util/canvasBounds.ts";
import { isPointInPolygon, polylineCrossesPolygon } from "#lib/util/geometry.ts";
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

/**
 * Scales a block by `s` around `anchor` (the corner that stays put).
 * By default ink gets thicker or thinner with it and text changes its font
 * size, so the result looks like a zoomed copy. With `keepWidths`, strokes
 * keep their line width and text its font size: only positions, lengths
 * and the wrap width change. Images are resized either way.
 */
export function scaleBlock(
  b: Block,
  s: number,
  anchor: Point2D,
  { keepWidths = false }: { keepWidths?: boolean } = {},
): Block {
  const w = keepWidths ? 1 : s;
  const sx = (x: number) => anchor.x + (x - anchor.x) * s;
  const sy = (y: number) => anchor.y + (y - anchor.y) * s;
  switch (b.type) {
    case "Stroke":
      return {
        ...b,
        id: newId(),
        thickness: b.thickness * w,
        points: b.points.map((p) => ({ ...p, x: sx(p.x), y: sy(p.y) })),
      };
    case "Text":
      return {
        ...b,
        id: newId(),
        x: sx(b.x),
        y: sy(b.y),
        width: b.width * s,
        font_size: b.font_size * w,
      };
    case "Image":
      return {
        ...b,
        id: newId(),
        x: sx(b.x),
        y: sy(b.y),
        width: b.width * s,
        height: b.height * s,
      };
    default:
      return assertNever(b);
  }
}

/**
 * Moving, scaling and rotating in one: `from` goes to `to`, and everything
 * else turns by `angle` (radians) and scales by `scale` around it. A drag
 * is `scale` 1 and `angle` 0; a two-finger pinch sets all four.
 */
export interface Similarity {
  from: Point2D;
  to: Point2D;
  scale: number;
  angle: number;
}

export function mapPoint(t: Similarity, p: Point2D): Point2D {
  const dx = p.x - t.from.x;
  const dy = p.y - t.from.y;
  const c = Math.cos(t.angle) * t.scale;
  const s = Math.sin(t.angle) * t.scale;
  return { x: t.to.x + c * dx - s * dy, y: t.to.y + s * dx + c * dy };
}

/** Where a block's centre goes under `t` (text and images stay upright). */
function mappedCentre(b: Block, t: Similarity): Point2D | null {
  const bounds = blockBounds(b);
  if (!bounds) return null;
  return mapPoint(t, { x: bounds.min.x + bounds.width / 2, y: bounds.min.y + bounds.height / 2 });
}

/**
 * Applies a `Similarity` to a block. Ink follows exactly (its points are
 * mapped). Text and images have no stored rotation, so they stay upright:
 * their centre is mapped and their size scaled. Line widths and font sizes
 * scale too unless `keepWidths` (as in `scaleBlock`).
 */
export function transformBlock(
  b: Block,
  t: Similarity,
  { keepWidths = false }: { keepWidths?: boolean } = {},
): Block {
  const w = keepWidths ? 1 : t.scale;
  switch (b.type) {
    case "Stroke":
      return {
        ...b,
        id: newId(),
        thickness: b.thickness * w,
        points: b.points.map((p) => ({ ...p, ...mapPoint(t, p) })),
      };
    case "Text": {
      const c = mappedCentre(b, t);
      if (!c) return b;
      const width = b.width * t.scale;
      // Its height follows from the layout; scaling it alike keeps the centre.
      const height = (blockBounds(b)?.height ?? 0) * w;
      return {
        ...b,
        id: newId(),
        x: c.x - width / 2,
        y: c.y - height / 2,
        width,
        font_size: b.font_size * w,
      };
    }
    case "Image": {
      const c = mappedCentre(b, t);
      if (!c) return b;
      const width = b.width * t.scale;
      const height = b.height * t.scale;
      return { ...b, id: newId(), x: c.x - width / 2, y: c.y - height / 2, width, height };
    }
    default:
      return assertNever(b);
  }
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
/**
 * How the lasso decides: "touch" selects a block as soon as any part of it
 * is inside the loop; "contain" only when all of it is (e.g. text written
 * over an image, without the image).
 */
export type LassoMode = "touch" | "contain";

export function blockInPolygon(b: Block, polygon: Point[], mode: LassoMode = "touch"): boolean {
  const inside = (p: Point2D) => isPointInPolygon(p, polygon);
  switch (b.type) {
    // Points and segments: a ruler line or a shape edge has few points,
    // so a lasso across the middle of it contains none of them.
    case "Stroke":
      return mode === "contain"
        ? b.points.every(inside) && !polylineCrossesPolygon(b.points, polygon)
        : b.points.some(inside) || polylineCrossesPolygon(b.points, polygon);
    case "Text":
    case "Image": {
      // Touch: any corner or the centre inside. Contain: all four corners.
      const bounds = blockBounds(b);
      if (!bounds) return false;
      const { min, max } = bounds;
      const corners: Point2D[] = [min, max, { x: min.x, y: max.y }, { x: max.x, y: min.y }];
      if (mode === "contain") return corners.every(inside);
      return [...corners, { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2 }].some(inside);
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
