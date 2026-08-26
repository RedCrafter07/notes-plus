import {
  canvasManager,
  type Tool,
} from "$lib/editor/state/canvasManager.svelte";
import { contentManager } from "$lib/state/contentManager.svelte";
import { settingsStore } from "$lib/state/settingsStore.svelte";
import { tabManager } from "$lib/state/tabManager.svelte";
import { toolHandlers, type ToolHandlers } from "./handlers";
import { toolFromButtons } from "./toolFromButtons.svelte";

const ZOOM_STEP = 1.1;

const TOOL_LABELS: Record<Tool, string> = {
  pen: "Draw",
  eraser: "Erase",
  lasso: "Select",
};

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
  let cursorX = 0;
  let cursorY = 0;
  let activeTool: Tool | undefined = undefined;
  const activeTouch = new Map<number, { x: number; y: number }>();

  // update elementRect on resize
  const obs = new ResizeObserver(() => {
    elementRect = element.getBoundingClientRect();
  });
  obs.observe(element);

  const isUIEvent = (e: Event) => {
    return (
      e.target instanceof Element &&
      e.target.closest('[data-ui="true"]') !== null
    );
  };

  function getPinchDistance(x1: number, y1: number, x2: number, y2: number) {
    return Math.hypot(x1 - x2, y1 - y2);
  }

  function getCenter(x1: number, y1: number, x2: number, y2: number) {
    return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
  }

  const onPointerDown = (e: PointerEvent) => {
    if (isUIEvent(e)) return;
    elementRect = element.getBoundingClientRect();
    if (e.pointerType === "touch") {
      activeTouch.set(e.pointerId, { x: e.clientX, y: e.clientY });
      return;
    } else if (e.pointerType === "pen") {
      const tool = toolFromButtons(e.buttons);
      if (tool) canvasManager.tool = tool;
    }

    element.setPointerCapture(e.pointerId);

    activeTool = canvasManager.tool;

    tabManager.tab.history.begin(TOOL_LABELS[activeTool]);

    callHandler(activeTool, "down", e);
  };

  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === "touch") {
      activeTouch.delete(e.pointerId);
      initialPinchDistance = undefined;
      return;
    }

    const tool = activeTool ?? canvasManager.tool;
    activeTool = undefined;

    callHandler(tool, "up", e);
    tabManager.tab.history.commit();
  };

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === "touch") {
      const prev = activeTouch.get(e.pointerId);
      activeTouch.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activeTouch.size === 1) {
        if (!prev) return;
        const dX = e.clientX - prev.x;
        const dY = e.clientY - prev.y;
        contentManager.panX += dX / contentManager.zoom;
        contentManager.panY += dY / contentManager.zoom;
        canvasManager.redrawStrokes();
      } else if (activeTouch.size === 2) {
        const [t0, t1] = [...activeTouch.values()];
        const d = getPinchDistance(t0.x, t0.y, t1.x, t1.y) || 1;
        const c = getCenter(t0.x, t0.y, t1.x, t1.y);

        const center = { x: c.x - elementRect.left, y: c.y - elementRect.top };

        if (initialPinchDistance !== undefined && prevCenter) {
          canvasManager.zoomAround(
            center.x,
            center.y,
            d / initialPinchDistance,
          );

          contentManager.panX +=
            (center.x - prevCenter.x) / contentManager.zoom;
          contentManager.panY +=
            (center.y - prevCenter.y) / contentManager.zoom;

          canvasManager.redrawStrokes();
        }

        initialPinchDistance = d;
        prevCenter = center;
      }
      return;
    }

    cursorX = e.offsetX;
    cursorY = e.offsetY;
    updateCursor(true, cursorX, cursorY);

    if (toolFromButtons(e.buttons) === undefined) return;

    const tool = activeTool ?? canvasManager.tool;

    if (tool === "pen") {
      for (const s of e.getCoalescedEvents?.() ?? [e]) {
        callHandler(tool, "move", s);
      }
    } else {
      callHandler(tool, "move", e);
    }
  };

  const onPointerEnter = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;

    elementRect = element.getBoundingClientRect();

    cursorX = e.offsetX;
    cursorY = e.offsetY;
    updateCursor(true, cursorX, cursorY);
  };

  const onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType === "touch") {
      activeTouch.delete(e.pointerId);
      initialPinchDistance = undefined;
      prevCenter = undefined;
      return;
    }

    updateCursor(false);
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();

    if (e.ctrlKey) {
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      canvasManager.zoomAround(e.offsetX, e.offsetY, factor);
    } else {
      // Allow the axes to be swapped?
      const a = settingsStore.store.shift_swaps_scroll_axes;
      const x = e.shiftKey && a ? e.deltaY : e.deltaX;
      const y = e.shiftKey && a ? e.deltaX : e.deltaY;

      contentManager.panX -= x / contentManager.zoom;
      contentManager.panY -= y / contentManager.zoom;
    }

    canvasManager.redrawStrokes();
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

  function callHandler(
    tool: Tool,
    action: keyof ToolHandlers,
    e: PointerEvent,
  ) {
    const point = canvasManager.translateToRelative(
      e.clientX - elementRect.x,
      e.clientY - elementRect.y,
      e.pressure,
    );

    toolHandlers[tool][action]?.(point, e);
  }
}
