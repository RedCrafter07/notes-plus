import { canvasManager } from "$lib/editor/state/canvasManager.svelte";
import { lassoManager } from "$lib/editor/state/lassoManager.svelte";
import { contentManager } from "$lib/state/contentManager.svelte";

export function canvasController(
  element: HTMLElement,
  {
    redrawStrokes,
    updateCursor,
  }: {
    redrawStrokes: () => void;
    updateCursor: (visible: boolean, x?: number, y?: number) => void;
  },
) {
  let pointerType = "mouse";
  let currentButton = -1;
  let touchX = 0;
  let touchY = 0;
  let initialPinchDistance = 1;
  let cursorX = 0;
  let cursorY = 0;

  function getPinchDistance(x1: number, y1: number, x2: number, y2: number) {
    return Math.hypot(x1 - x2, y1 - y2);
  }

  function getCenter(x1: number, y1: number, x2: number, y2: number) {
    return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
  }

  const onPointerEnter = (e: PointerEvent) => {
    cursorX = e.offsetX;
    cursorY = e.offsetY;
    updateCursor(true, cursorX, cursorY);
  };

  const onPointerLeave = () => {
    updateCursor(false);
    currentButton = -1;
    if (canvasManager.tool === "lasso") {
      if (!lassoManager.isSelecting) lassoManager.isSelecting = true;
      if (lassoManager.isSelecting) {
        lassoManager.updateSelection();
        redrawStrokes();
      } else {
        const noSelection = !lassoManager.selectedLayers.some(
          (l) => lassoManager.selection![l].length > 0,
        );
        lassoManager.isSelecting = noSelection;
        if (noSelection) lassoManager.points = [];
      }
    }
    if (canvasManager.drawing) {
      canvasManager.drawing = false;
      canvasManager.finishStroke();
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    if (canvasManager.tool === "lasso" && !lassoManager.isSelecting) {
      const cursorRelative = canvasManager.translateToRelative(
        e.offsetX,
        e.offsetY,
      );
      if (
        lassoManager.boundingBox &&
        cursorRelative.x >= lassoManager.boundingBox.x &&
        cursorRelative.x <=
          lassoManager.boundingBox.x + lassoManager.boundingBox.width &&
        cursorRelative.y >= lassoManager.boundingBox.y &&
        cursorRelative.y <=
          lassoManager.boundingBox.y + lassoManager.boundingBox.height
      ) {
        lassoManager.isDraggingSelection = true;
        lassoManager.dragStart = cursorRelative;
        return;
      } else {
        lassoManager.reset();
        redrawStrokes();
      }
    }

    pointerType = e.pointerType;
    currentButton = e.button;

    if (!canvasManager.lockTool) {
      switch (e.button) {
        case 0:
          canvasManager.tool = "pen";
          break;
        case 1:
          canvasManager.tool = "lasso";
          break;
        case 5:
          canvasManager.tool = "eraser";
          break;
      }
    }

    if (canvasManager.tool !== "lasso") lassoManager.isSelecting = true;

    if (
      e.button === 0 &&
      pointerType !== "touch" &&
      canvasManager.tool === "pen"
    ) {
      canvasManager.drawing = true;
      canvasManager.addPoint(e.offsetX, e.offsetY, e.pressure ?? 0.5);
    } else if (canvasManager.tool === "eraser") {
      canvasManager.eraser(e.offsetX, e.offsetY);
    } else if (canvasManager.tool === "lasso") {
      lassoManager.points = [];
      redrawStrokes();
      lassoManager.isSelecting = true;
    }
  };

  const onPointerUp = () => {
    if (canvasManager.tool === "lasso") {
      if (lassoManager.isDraggingSelection) {
        lassoManager.isDraggingSelection = false;
        lassoManager.updateDrag();
      } else if (lassoManager.isSelecting) {
        lassoManager.updateSelection();
        redrawStrokes();
        if (!lassoManager.selection) {
          lassoManager.isSelecting = true;
          lassoManager.points = [];
        } else {
          const noSelection = !lassoManager.selectedLayers.some(
            (l) => lassoManager.selection![l].length > 0,
          );
          lassoManager.isSelecting = noSelection;
          if (noSelection) lassoManager.points = [];
        }
      }
    }

    currentButton = -1;
    canvasManager.drawing = false;
    canvasManager.finishStroke();
  };

  const onPointerMove = (e: PointerEvent) => {
    if (lassoManager.isDraggingSelection) {
      lassoManager.dragOffsetX += (e.offsetX - cursorX) / contentManager.zoom;
      lassoManager.dragOffsetY += (e.offsetY - cursorY) / contentManager.zoom;
    }
    cursorX = e.offsetX;
    cursorY = e.offsetY;
    updateCursor(true, cursorX, cursorY);

    switch (currentButton) {
      case 0:
        if (canvasManager.drawing) {
          canvasManager.addPoint(e.offsetX, e.offsetY, e.pressure ?? 0.5);
        } else if (canvasManager.tool === "eraser") {
          canvasManager.eraser(e.offsetX, e.offsetY);
        } else if (canvasManager.tool === "lasso") {
          lassoManager.points.push(
            canvasManager.translateToRelative(e.offsetX, e.offsetY, e.pressure),
          );
        }
        break;
      case 5:
        canvasManager.eraser(e.offsetX, e.offsetY);
        break;
      case 1:
        if (canvasManager.tool === "lasso") {
          lassoManager.points.push(
            canvasManager.translateToRelative(e.offsetX, e.offsetY, e.pressure),
          );
        }
        break;
    }
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey) {
      if (e.deltaY > 0) contentManager.zoom /= Math.abs(e.deltaY / 90);
      else contentManager.zoom *= Math.abs(e.deltaY / 90);
    } else {
      let x = e.shiftKey ? e.deltaY : e.deltaX;
      let y = e.shiftKey ? e.deltaX : e.deltaY;
      contentManager.panX -= x;
      contentManager.panY -= y;
    }
    redrawStrokes();
  };

  const onTouchStart = (e: TouchEvent) => {
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
      redrawStrokes();
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
      redrawStrokes();
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
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("touchstart", onTouchStart);
      element.removeEventListener("touchmove", onTouchMove);
      element.removeEventListener("touchend", onTouchEnd);
    },
  };
}
