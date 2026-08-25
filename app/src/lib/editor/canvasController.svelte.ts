import {
  canvasManager,
  type Tool,
} from "$lib/editor/state/canvasManager.svelte";
import { contentManager } from "$lib/state/contentManager.svelte";
import { settingsStore } from "$lib/state/settingsStore.svelte";
import { toolHandlers, type ToolHandlers } from "./handlers";
import { toolFromButtons } from "./toolFromButtons.svelte";

const ZOOM_STEP = 1.1;

export function canvasController(
  element: HTMLElement,
  {
    updateCursor,
  }: {
    updateCursor: (visible: boolean, x?: number, y?: number) => void;
  },
) {
  let pointerType = "mouse";
  let touchX = 0;
  let touchY = 0;
  let initialPinchDistance = 1;
  let cursorX = 0;
  let cursorY = 0;
  let activeTool: Tool | undefined = undefined;

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
    pointerType = e.pointerType;
    if (pointerType === "touch") return;
    if (e.pointerType === "pen") {
      const tool = toolFromButtons(e.buttons);
      if (tool) canvasManager.tool = tool;
    }

    activeTool = canvasManager.tool;

    callHandler(activeTool, "down", e);
  };

  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;

    const tool = activeTool ?? canvasManager.tool;
    activeTool = undefined;

    callHandler(tool, "up", e);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;

    cursorX = e.offsetX;
    cursorY = e.offsetY;
    updateCursor(true, cursorX, cursorY);

    if (toolFromButtons(e.buttons) === undefined) return;

    callHandler(activeTool ?? canvasManager.tool, "move", e);
  };

  const onPointerEnter = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;

    cursorX = e.offsetX;
    cursorY = e.offsetY;
    updateCursor(true, cursorX, cursorY);
  };

  const onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    updateCursor(false);
    onPointerUp(e);
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();

    if (e.ctrlKey) {
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      contentManager.zoom *= factor;
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

  const onTouchStart = (e: TouchEvent) => {
    if (isUIEvent(e)) return;
    if (pointerType !== "touch") return;
    if (e.touches.length === 1) {
      e.preventDefault();
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      initialPinchDistance = getPinchDistance(
        e.touches[0].clientX,
        e.touches[0].clientY,
        e.touches[1].clientX,
        e.touches[1].clientY,
      );
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    if (pointerType !== "touch") return;
    if (e.touches.length === 1) {
      const deltaX = e.touches[0].clientX - touchX;
      const deltaY = e.touches[0].clientY - touchY;
      contentManager.panX += deltaX / contentManager.zoom;
      contentManager.panY += deltaY / contentManager.zoom;
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
      canvasManager.redrawStrokes();
    } else if (e.touches.length === 2) {
      let currentDistance = getPinchDistance(
        e.touches[0].clientX,
        e.touches[0].clientY,
        e.touches[1].clientX,
        e.touches[1].clientY,
      );
      if (currentDistance <= 0) currentDistance = 1;
      contentManager.zoom *= currentDistance / initialPinchDistance;
      initialPinchDistance = currentDistance;
      canvasManager.redrawStrokes();
    }
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
    }
  };

  element.addEventListener("pointerenter", onPointerEnter);
  element.addEventListener("pointerleave", onPointerLeave);
  element.addEventListener("pointerdown", onPointerDown);
  element.addEventListener("pointermove", onPointerMove);
  element.addEventListener("pointerup", onPointerUp);
  element.addEventListener("pointercancel", onPointerUp);
  element.addEventListener("wheel", onWheel, { passive: false });
  element.addEventListener("touchstart", onTouchStart, { passive: false });
  element.addEventListener("touchmove", onTouchMove, { passive: false });
  element.addEventListener("touchend", onTouchEnd);

  return {
    destroy() {
      element.removeEventListener("pointerenter", onPointerEnter);
      element.removeEventListener("pointerleave", onPointerLeave);
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("pointercancel", onPointerUp);
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("touchstart", onTouchStart);
      element.removeEventListener("touchmove", onTouchMove);
      element.removeEventListener("touchend", onTouchEnd);
    },
  };
}

function callHandler(tool: Tool, action: keyof ToolHandlers, e: PointerEvent) {
  const point = canvasManager.translateToRelative(
    e.offsetX,
    e.offsetY,
    e.pressure,
  );

  toolHandlers[tool][action]?.(point, e);
}
