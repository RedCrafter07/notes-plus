import { canvasManager } from "$lib/editor/state/canvasManager.svelte";
import { textEditor } from "$lib/editor/state/textEditor.svelte";
import type { ToolHandler, ToolHandlers } from "./types";

/**
 * Tap on text to edit it, tap on empty space to start a new box. While a box
 * is open, a tap anywhere else only closes it, so a stray tap does not
 * immediately spawn a second box.
 */
const down: ToolHandler = (p, e) => {
  if (e.button !== 0) return;

  if (textEditor.draft) {
    textEditor.commit();
    return;
  }

  const hit = textEditor.hitTest(p);
  if (hit) textEditor.edit(hit.layerId, hit.block);
  else textEditor.create(p, canvasManager.sizes.text, canvasManager.color);
};

export const text: ToolHandlers = { down };
