import { canvasManager } from "$lib/editor/state/canvasManager.svelte";
import { settingsStore } from "$lib/state/settingsStore.svelte";
import { tabManager } from "$lib/state/tabManager.svelte";
import { toolDef, type Tool } from "./tools/registry";
import type { ToolHandlers } from "./tools/types";
import { toolFromButtons } from "./toolFromButtons.svelte";

const ZOOM_STEP = 1.1;

/** A multi-finger touch counts as a tap if it ends this quickly... */
const TAP_MAX_MS = 300;
/** ...and no finger moved further than this (screen px). */
const TAP_MAX_MOVE = 12;

export function canvasController(
  element: HTMLElement,
  {
    updateCursor,
  }: {
    updateCursor: (visible: boolean, x?: number, y?: number) => void;
  },
) {
  let elementRect = element.getBoundingClientRect();
  let initialPinchDistance: number | undefined;
  let prevCenter: Record<"x" | "y", number> | undefined;
  let activeTool: Tool | undefined = undefined;
  /** Pen/mouse pointer currently drawing; touches are ignored meanwhile (palm rejection). */
  let inkPointer: number | undefined;
  const activeTouch = new Map<number, { x: number; y: number }>();

  /** Tracks one multi-finger touch sequence, to detect undo/redo taps. */
  let tap: { start: number; fingers: number; origin: Map<number, { x: number; y: number }>; moved: boolean } | undefined;

  const obs = new ResizeObserver(() => {
    elementRect = element.getBoundingClientRect();
  });
  obs.observe(element);

  const isUIEvent = (e: Event) =>
    e.target instanceof Element && e.target.closest('[data-ui="true"]') !== null;

  // ------------------------------------------------------------------ touch

  function touchDown(e: PointerEvent) {
    if (inkPointer !== undefined) return; // palm while writing
    activeTouch.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (!tap) tap = { start: e.timeStamp, fingers: 0, origin: new Map(), moved: false };
    tap.origin.set(e.pointerId, { x: e.clientX, y: e.clientY });
    tap.fingers = Math.max(tap.fingers, activeTouch.size);
    // Pinch math restarts whenever the finger count changes.
    initialPinchDistance = undefined;
    prevCenter = undefined;
  }

  function touchMove(e: PointerEvent) {
    const prev = activeTouch.get(e.pointerId);
    if (!prev) return;
    activeTouch.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const o = tap?.origin.get(e.pointerId);
    if (tap && o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > TAP_MAX_MOVE)
      tap.moved = true;

    if (activeTouch.size === 1) {
      canvasManager.panBy(e.clientX - prev.x, e.clientY - prev.y);
    } else if (activeTouch.size === 2) {
      const [t0, t1] = [...activeTouch.values()];
      const d = Math.hypot(t0.x - t1.x, t0.y - t1.y) || 1;
      const center = {
        x: (t0.x + t1.x) / 2 - elementRect.left,
        y: (t0.y + t1.y) / 2 - elementRect.top,
      };

      if (initialPinchDistance !== undefined && prevCenter) {
        canvasManager.zoomAround(center.x, center.y, d / initialPinchDistance);
        canvasManager.panBy(center.x - prevCenter.x, center.y - prevCenter.y);
      }

      initialPinchDistance = d;
      prevCenter = center;
    }
  }

  function touchUp(e: PointerEvent) {
    if (!activeTouch.delete(e.pointerId)) return;
    initialPinchDistance = undefined;
    prevCenter = undefined;

    if (activeTouch.size > 0 || !tap) return;

    // All fingers lifted: was it a quick multi-finger tap?
    const quick = e.timeStamp - tap.start < TAP_MAX_MS && !tap.moved;
    if (quick && tap.fingers === 2) tabManager.undo();
    else if (quick && tap.fingers === 3) tabManager.redo();
    tap = undefined;
  }

  // ------------------------------------------------------------ pen / mouse

  const onPointerDown = (e: PointerEvent) => {
    if (isUIEvent(e)) return;
    elementRect = element.getBoundingClientRect();

    if (e.pointerType === "touch") return touchDown(e);

    // Suppress the compatibility mousedown, whose default action would move
    // focus to <body> and immediately blur a text box this tap just opened.
    e.preventDefault();

    if (e.pointerType === "pen") {
      const tool = toolFromButtons(e.buttons);
      if (tool) canvasManager.tool = tool;
      // A pen landing cancels any pan/pinch the palm may have started.
      activeTouch.clear();
      tap = undefined;
    }

    element.setPointerCapture(e.pointerId);
    inkPointer = e.pointerId;
    activeTool = canvasManager.tool;

    tabManager.tab?.history.begin(toolDef(activeTool).action);
    callHandler(activeTool, "down", e);
  };

  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === "touch") return touchUp(e);
    if (e.pointerId !== inkPointer) return;

    const tool = activeTool ?? canvasManager.tool;
    activeTool = undefined;
    inkPointer = undefined;

    callHandler(tool, "up", e);
    tabManager.tab?.history.commit();
  };

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === "touch") return touchMove(e);

    updateCursor(true, e.clientX - elementRect.left, e.clientY - elementRect.top);

    if (e.pointerId !== inkPointer) return;
    if (toolFromButtons(e.buttons) === undefined) return;

    const tool = activeTool ?? canvasManager.tool;

    // Coalesced events give the full pen sample rate; only drawing needs it.
    const events =
      tool === "pen" || tool === "highlighter"
        ? (e.getCoalescedEvents?.() ?? [e])
        : [e];
    for (const s of events.length ? events : [e]) callHandler(tool, "move", s);
  };

  const onPointerEnter = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    elementRect = element.getBoundingClientRect();
    updateCursor(true, e.clientX - elementRect.left, e.clientY - elementRect.top);
  };

  const onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType !== "touch") updateCursor(false);
  };

  const onWheel = (e: WheelEvent) => {
    if (isUIEvent(e)) return;
    e.preventDefault();

    const x = e.clientX - elementRect.left;
    const y = e.clientY - elementRect.top;

    if (e.ctrlKey) {
      // Trackpad pinches arrive as ctrl+wheel with small deltas; scale with them.
      const factor = Math.pow(ZOOM_STEP, -e.deltaY / (Math.abs(e.deltaY) > 20 ? 100 : 10));
      canvasManager.zoomAround(x, y, factor);
    } else {
      const swap = e.shiftKey && settingsStore.store.shift_swaps_scroll_axes;
      const dx = swap ? e.deltaY : e.deltaX;
      const dy = swap ? e.deltaX : e.deltaY;
      canvasManager.panBy(-dx, -dy);
    }
  };

  const cleanups: (() => void)[] = [];

  on("pointerenter", onPointerEnter);
  on("pointerleave", onPointerLeave);
  on("pointerdown", onPointerDown);
  on("pointermove", onPointerMove);
  on("pointerup", onPointerUp);
  on("pointercancel", onPointerUp);
  on("wheel", onWheel, { passive: false });

  function on<K extends keyof HTMLElementEventMap>(
    type: K,
    handler: (e: HTMLElementEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ) {
    element.addEventListener(type, handler, options);
    cleanups.push(() => element.removeEventListener(type, handler, options));
  }

  return {
    destroy() {
      cleanups.forEach((c) => c());
      obs.disconnect();
    },
  };

  function callHandler(tool: Tool, action: keyof ToolHandlers, e: PointerEvent) {
    const point = canvasManager.translateToRelative(
      e.clientX - elementRect.x,
      e.clientY - elementRect.y,
      e.pressure,
    );

    toolDef(tool).handlers[action]?.(point, e);
  }
}
