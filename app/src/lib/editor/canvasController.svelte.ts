import { canvasManager } from "#lib/editor/state/canvasManager.svelte.ts";
import { settingsStore } from "#lib/state/settingsStore.svelte.ts";
import { tabManager } from "#lib/state/tabManager.svelte.ts";
import { toolDef, type Tool } from "./tools/registry";
import type { ToolHandlers } from "./tools/types";
import { penOverride } from "./penButtons";
import { lassoManager } from "./state/lassoManager.svelte";
import type { Similarity } from "./blocks";
import type { Point2D } from "#lib/util/canvasBounds.ts";

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

  /*
   * "Move selections from anywhere" (setting): while something is selected
   * with the lasso, one finger moves the selection and two fingers move,
   * scale and rotate it, instead of panning and zooming the view. Finger
   * positions are remembered in page coordinates whenever the set of
   * fingers changes (`baseline`); each move turns baseline-to-now into one
   * `Similarity` for lassoManager to preview. Once a touch sequence starts
   * in this mode it stays in it until every finger is up.
   */
  let gestureActive = false;
  let baseline: Map<number, Point2D> | undefined;

  const transformMode = () =>
    settingsStore.store.transform_anywhere &&
    canvasManager.tool === "lasso" &&
    !!lassoManager.selection &&
    !lassoManager.isSelecting;

  const pageAt = (p: { x: number; y: number }): Point2D =>
    canvasManager.translateToRelative(p.x - elementRect.left, p.y - elementRect.top);

  /** Applies the gesture so far and starts measuring from the current fingers. */
  function rebaseline() {
    lassoManager.applyGesture();
    baseline = new Map([...activeTouch].map(([id, p]) => [id, pageAt(p)]));
  }

  function gestureNow(): Similarity | undefined {
    if (!baseline) return;
    const ids = [...activeTouch.keys()].filter((id) => baseline!.has(id));
    const before = ids.map((id) => baseline!.get(id)!);
    const now = ids.map((id) => pageAt(activeTouch.get(id)!));
    if (ids.length === 1) return { from: before[0], to: now[0], scale: 1, angle: 0 };
    if (ids.length !== 2) return;
    const mid = (a: Point2D, b: Point2D) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const d0 = Math.hypot(before[1].x - before[0].x, before[1].y - before[0].y) || 1;
    const d1 = Math.hypot(now[1].x - now[0].x, now[1].y - now[0].y);
    const a0 = Math.atan2(before[1].y - before[0].y, before[1].x - before[0].x);
    const a1 = Math.atan2(now[1].y - now[0].y, now[1].x - now[0].x);
    const angle = lassoManager.rotationLock ? 0 : a1 - a0;
    return { from: mid(before[0], before[1]), to: mid(now[0], now[1]), scale: d1 / d0, angle };
  }

  function touchDown(e: PointerEvent) {
    if (inkPointer !== undefined) return; // palm while writing
    activeTouch.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (!tap) tap = { start: e.timeStamp, fingers: 0, origin: new Map(), moved: false };
    tap.origin.set(e.pointerId, { x: e.clientX, y: e.clientY });
    tap.fingers = Math.max(tap.fingers, activeTouch.size);
    // Pinch math restarts whenever the finger count changes.
    initialPinchDistance = undefined;
    prevCenter = undefined;

    if (gestureActive || (activeTouch.size === 1 && transformMode())) {
      if (!gestureActive) lassoManager.beginGestures();
      gestureActive = true;
      rebaseline();
    }
  }

  function touchMove(e: PointerEvent) {
    const prev = activeTouch.get(e.pointerId);
    if (!prev) return;
    activeTouch.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const o = tap?.origin.get(e.pointerId);
    if (tap && o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > TAP_MAX_MOVE)
      tap.moved = true;

    if (gestureActive) {
      lassoManager.gesture = gestureNow();
      return;
    }

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

    if (gestureActive) {
      // A touch that never really moved is a tap (two fingers = undo):
      // drop its jitter rather than turning it into an undo step of its own.
      if (!tap?.moved) lassoManager.gesture = undefined;
      if (activeTouch.size > 0) rebaseline();
      else {
        lassoManager.endGestures();
        gestureActive = false;
        baseline = undefined;
      }
    }

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
    canvasManager.gesture = true;

    let held: Tool | undefined;
    if (e.pointerType === "pen") {
      const o = penOverride(e.buttons, canvasManager.tool, {
        disabled: canvasManager.lockTool || settingsStore.store.disable_tool_switch,
        barrel: settingsStore.store.barrel_button,
      });
      if (o?.mode === "sticky") canvasManager.switchTemporarily(o.tool);
      else if (o?.mode === "hold") held = o.tool;
      // A pen landing cancels any pan/pinch the palm may have started.
      activeTouch.clear();
      tap = undefined;
    }

    element.setPointerCapture(e.pointerId);
    inkPointer = e.pointerId;
    // A held tool (eraser end) is used for this gesture only.
    activeTool = held ?? canvasManager.tool;
    canvasManager.heldTool = held;

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

    canvasManager.heldTool = undefined;
    canvasManager.gesture = false;
    canvasManager.returnFromTemporaryTool();
  };

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === "touch") return touchMove(e);

    updateCursor(true, e.clientX - elementRect.left, e.clientY - elementRect.top);

    if (e.pointerId !== inkPointer) return;
    if (e.buttons === 0) return; // hovering

    const tool = activeTool ?? canvasManager.tool;

    // Coalesced events give the full pen sample rate; only drawing needs it.
    const events =
      tool === "pen" || tool === "highlighter" || tool === "laser"
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
