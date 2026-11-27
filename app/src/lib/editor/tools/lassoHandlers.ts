import { lassoManager } from "#lib/editor/state/lassoManager.svelte.ts";
import type { ToolHandler, ToolHandlers } from "./types";

const down: ToolHandler = (p) => {
  lassoManager.begin(p);
};
const move: ToolHandler = (p) => {
  if (lassoManager.scaling) {
    lassoManager.updateScale(p);
    return;
  }
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
