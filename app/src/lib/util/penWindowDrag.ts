import { getCurrentWindow, PhysicalPosition } from "@tauri-apps/api/window";
import { commands } from "#lib/tauri/bindings.ts";

const ATTR = "data-tauri-drag-region";

/** Same rule as Tauri's own drag script: the pressed element itself, or a "deep" ancestor. */
function inDragRegion(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const own = target.getAttribute(ATTR);
  if (own === "" || own === "true") return true;
  return target.closest(`[${ATTR}="deep"]`) !== null;
}

/**
 * Lets a pen or finger move the window by its `data-tauri-drag-region`s.
 *
 * Tauri's drag regions hand the press to the OS's own move loop
 * (`start_dragging`), which on Windows follows the mouse button: a pen or
 * touch press ends it at once, so the window does not move. For those, the
 * backend follows the cursor (`start_window_drag`) until the pen lifts: no
 * IPC per movement, so the window keeps up with the pen. Where it cannot
 * (Wayland), the window is moved from here instead. The mouse keeps the
 * native behaviour (snapping, double-click to maximize).
 *
 * Returns a function that removes the listener.
 */
export function enablePenWindowDrag(): () => void {
  const down = (e: PointerEvent) => {
    if (e.pointerType === "mouse" || !e.isPrimary || !inDragRegion(e.target)) return;
    // Also stops the compatibility mousedown that would start the native drag.
    e.preventDefault();

    const el = e.target as HTMLElement;
    el.setPointerCapture(e.pointerId);

    let released = false;
    let stopFallback: (() => void) | undefined;

    commands.startWindowDrag().then((native) => {
      // Lifted before the backend answered: its stop came first, so stop again.
      if (native && released) commands.stopWindowDrag();
      else if (!native && !released) stopFallback = frontendDrag(el, e);
    });

    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      released = true;
      commands.stopWindowDrag();
      stopFallback?.();
      el.removeEventListener("pointerup", end);
      el.removeEventListener("pointercancel", end);
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  };

  document.addEventListener("pointerdown", down);
  return () => document.removeEventListener("pointerdown", down);
}

/** Moves the window from the frontend, one IPC call per frame. The fallback. */
function frontendDrag(el: HTMLElement, start: PointerEvent): () => void {
  const win = getCurrentWindow();
  let origin: PhysicalPosition | undefined;
  let scale = 1;
  let last = { x: start.screenX, y: start.screenY };
  let frame = 0;

  Promise.all([win.outerPosition(), win.scaleFactor()]).then(([p, s]) => {
    origin = p;
    scale = s;
  });

  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== start.pointerId) return;
    last = { x: ev.screenX, y: ev.screenY };
    frame ||= requestAnimationFrame(() => {
      frame = 0;
      if (!origin) return;
      // screenX/Y are CSS pixels, the window position is physical.
      const x = origin.x + Math.round((last.x - start.screenX) * scale);
      const y = origin.y + Math.round((last.y - start.screenY) * scale);
      win.setPosition(new PhysicalPosition(x, y));
    });
  };
  el.addEventListener("pointermove", move);
  return () => {
    cancelAnimationFrame(frame);
    el.removeEventListener("pointermove", move);
  };
}
