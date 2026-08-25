import { lassoManager } from "$lib/editor/state/lassoManager.svelte";
import type { ToolHandler, ToolHandlers } from "..";

const down: ToolHandler = (p) => {
  lassoManager.begin(p);
};
const move: ToolHandler = (p) => {
  if (lassoManager.isDraggingSelection) {
    lassoManager.dragOffsetX = p.x - lassoManager.dragStart.x;
    lassoManager.dragOffsetY = p.y - lassoManager.dragStart.y;
    return;
  }

  if (!lassoManager.isSelecting) return;
  lassoManager.points.push(p);
};
const up: ToolHandler = () => {
  lassoManager.commit();
};

export const lasso: ToolHandlers = { down, move, up };
