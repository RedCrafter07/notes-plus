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

/** `full` is false only when every request this frame was partial. */
type Painter = (full: boolean) => void;

const painters = new Set<Painter>();
let frame = 0;
let full = false;

/**
 * `partial`: the caller has recorded which area changed (the eraser) and a
 * painter may redraw just that. Any full request in the same frame wins.
 */
export function requestRedraw(partial = false) {
  if (!partial) full = true;
  if (frame || typeof requestAnimationFrame === "undefined") return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const f = full;
    full = false;
    for (const paint of painters) paint(f);
  });
}

/** Registers a painter. Returns an unsubscribe function. */
export function onPaint(paint: Painter) {
  painters.add(paint);
  return () => painters.delete(paint);
}
