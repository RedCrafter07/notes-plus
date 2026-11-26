import { getCurrentWindow, PhysicalPosition } from "@tauri-apps/api/window";

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
 * touch press ends it at once, so the window does not move. For those, this
 * moves the window itself; the mouse keeps the native behaviour (snapping,
 * double-click to maximize). Returns a function that removes the listener.
 */
export function enablePenWindowDrag(): () => void {
  const win = getCurrentWindow();

  const down = (e: PointerEvent) => {
    if (e.pointerType === "mouse" || !e.isPrimary || !inDragRegion(e.target)) return;
    // Also stops the compatibility mousedown that would start the native drag.
    e.preventDefault();

    const el = e.target as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const startX = e.screenX;
    const startY = e.screenY;
    let origin: PhysicalPosition | undefined;
    let scale = 1;
    let last = { x: startX, y: startY };
    let frame = 0;

    Promise.all([win.outerPosition(), win.scaleFactor()]).then(([p, s]) => {
      origin = p;
      scale = s;
    });

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      last = { x: ev.screenX, y: ev.screenY };
      // One IPC call per frame, however fast the pen reports.
      frame ||= requestAnimationFrame(() => {
        frame = 0;
        if (!origin) return;
        // screenX/Y are CSS pixels, the window position is physical.
        const x = origin.x + Math.round((last.x - startX) * scale);
        const y = origin.y + Math.round((last.y - startY) * scale);
        win.setPosition(new PhysicalPosition(x, y));
      });
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", end);
      el.removeEventListener("pointercancel", end);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  };

  document.addEventListener("pointerdown", down);
  return () => document.removeEventListener("pointerdown", down);
}
