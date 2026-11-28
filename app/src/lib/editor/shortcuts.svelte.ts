import { overlayManager } from "#lib/state/overlayManager.svelte.ts";
import { contentManager } from "#lib/state/contentManager.svelte.ts";
import { tabManager } from "#lib/state/tabManager.svelte.ts";
import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import { handleSave } from "./handleSave.svelte";
import { canvasManager } from "./state/canvasManager.svelte";
import { lassoManager } from "./state/lassoManager.svelte";
import type { Tool } from "./tools/registry";
import { presenter } from "#lib/present/presenter.svelte.ts";
import { blockClipboard } from "#lib/state/blockClipboard.svelte.ts";

/** Single-key tool shortcuts (only when not typing). */
const TOOL_KEYS: Record<string, Tool> = {
  p: "pen",
  h: "highlighter",
  e: "eraser",
  s: "lasso",
  t: "text",
};

function isTyping(e: KeyboardEvent) {
  const t = e.target;
  return (
    t instanceof HTMLElement &&
    (t.isContentEditable || t.closest("input, textarea, select") !== null)
  );
}

export function useShortcuts() {
  $effect(() => {
    const event = async (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      if (e.ctrlKey) {
        // Copy/cut a lasso selection; in a text field these stay the field's own.
        if ((key === "c" || key === "x") && !isTyping(e) && lassoManager.selection) {
          e.preventDefault();
          await (key === "c" ? blockClipboard.copy() : blockClipboard.cut());
          return;
        }
        if (key === "s") {
          e.preventDefault();
          await handleSave(e.shiftKey);
        } else if (key === "z") {
          e.preventDefault();
          tabManager[e.shiftKey ? "redo" : "undo"]();
        } else if (key === "y") {
          e.preventDefault();
          tabManager.redo();
        } else if (key === "e") {
          e.preventDefault();
          goto(resolve("/export/[id]", { id: contentManager.id }));
        } else if (key === "0") {
          e.preventDefault();
          canvasManager.fitPage();
        } else if (key === "g") {
          e.preventDefault();
          if (overlayManager.open === "pages") overlayManager.close();
          else overlayManager.setOpen("pages");
        }
        return;
      }

      if (isTyping(e) || e.altKey || e.metaKey) return;

      if (e.key === "F5") {
        e.preventDefault(); // also stops the webview from reloading
        await presenter.toggle();
        return;
      }

      if (e.key === "PageDown") {
        e.preventDefault();
        contentManager.currentPage += 1;
      } else if (e.key === "PageUp") {
        e.preventDefault();
        contentManager.currentPage -= 1;
      } else if ((e.key === "Delete" || e.key === "Backspace") && lassoManager.selection) {
        e.preventDefault();
        lassoManager.deleteSelection();
      } else if (TOOL_KEYS[key] && !e.shiftKey) {
        canvasManager.tool = TOOL_KEYS[key];
      }
    };
    document.addEventListener("keydown", event);

    return () => {
      document.removeEventListener("keydown", event);
    };
  });
}
