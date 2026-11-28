import { page } from "$app/state";
import { sessionAssets } from "#lib/editor/assets.ts";
import { canvasManager } from "#lib/editor/state/canvasManager.svelte.ts";
import { popupManager } from "#lib/state/popupManager.svelte.ts";
import { tabManager } from "#lib/state/tabManager.svelte.ts";
import { commands, type DroppedFiles } from "#lib/tauri/bindings.ts";
import type { Point2D } from "#lib/util/canvasBounds.ts";
import { insertImageFile } from "./image";
import { pdfImport } from "./pdfImport.svelte";

/*
 * Images and PDFs dropped on the window (see `handle_drag_drop.rs`). The
 * backend has copied them into a temporary asset session; they are read
 * from there by URL, handed to the same paths as the toolbar's insert
 * button, and the session is closed again. Images land where they were
 * dropped; a PDF opens the import dialog.
 */

/** Gap between several images dropped at once (content units). */
const STACK = 24;

export async function handleDroppedFiles({ session, files, x, y }: DroppedFiles) {
  try {
    if (!page.route.id?.startsWith("/edit") || !tabManager.tab) {
      popupManager.add({ type: "warning", message: "Open a notebook to add images or PDFs to it." });
      return;
    }
    const url = sessionAssets(session);
    const asFile = async (f: DroppedFiles["files"][number]) =>
      new File([await (await fetch(url(f.id))).blob()], f.name, { type: f.mime });

    const at = dropPoint(x, y);
    const images = files.filter((f) => f.mime.startsWith("image/"));
    for (const [i, f] of images.entries())
      await insertImageFile(await asFile(f), at && { x: at.x + i * STACK, y: at.y + i * STACK });

    const pdfs = files.filter((f) => f.mime === "application/pdf");
    if (pdfs.length) {
      await pdfImport.start(await asFile(pdfs[0]));
      if (pdfs.length > 1)
        popupManager.add({ type: "info", message: "PDFs are imported one at a time: drop the others afterwards." });
    }
  } finally {
    commands.closeAssetSession(session);
  }
}

/** The drop point on the page, or undefined if it missed the canvas. */
function dropPoint(x: number, y: number): Point2D | undefined {
  const canvas = Object.values(canvasManager.layerCtx)[0]?.canvas;
  const r = canvas?.getBoundingClientRect();
  if (!r || x < r.left || x > r.right || y < r.top || y > r.bottom) return;
  return canvasManager.translateToRelative(x - r.left, y - r.top);
}
