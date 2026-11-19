/*
 * One requestAnimationFrame loop for the whole editor.
 *
 * Anything that changes what is on screen calls `requestRedraw()`. That only
 * sets a flag; the actual drawing happens at most once per frame. Twenty
 * pointer events inside one frame cost one redraw instead of twenty.
 *
 * This module imports nothing, so state modules (contentManager, history) can
 * request a redraw without importing canvasManager. That keeps the import
 * graph acyclic.
 */

type Painter = () => void;

const painters = new Set<Painter>();
let frame = 0;

export function requestRedraw() {
  if (frame || typeof requestAnimationFrame === "undefined") return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    for (const paint of painters) paint();
  });
}

/** Registers a painter. Returns an unsubscribe function. */
export function onPaint(paint: Painter) {
  painters.add(paint);
  return () => painters.delete(paint);
}
