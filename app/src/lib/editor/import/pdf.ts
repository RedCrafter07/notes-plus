import { contentManager } from "$lib/state/contentManager.svelte";
import { defaultsStore } from "$lib/state/defaultsStore.svelte";
import { popupManager } from "$lib/state/popupManager.svelte";
import type { Page } from "$lib/tauri/bindings";

/** PDF points are 1/72 inch; content units are 1/96 inch. */
const PT_TO_UNITS = 96 / 72;
/** Render at twice the page's size so slides stay sharp when zoomed in. */
const RENDER_SCALE = 2;
const JPEG_QUALITY = 0.88;

/**
 * Imports a PDF as one page per PDF page, each with the rendered PDF page as
 * its (non-editable) background, sized to match. You then write on it like
 * any other page; export puts your ink on top of the slide.
 *
 * pdf.js is loaded on first use only, so it costs nothing at startup.
 */
export async function importPdf(file: File) {
  popupManager.add({ type: "info", message: `Importing "${file.name}"…` });

  try {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const baseName = file.name.replace(/\.pdf$/i, "");
    const template = $state.snapshot(defaultsStore.store.page);
    const pages: Page[] = [];

    for (let n = 1; n <= doc.numPages; n++) {
      const pdfPage = await doc.getPage(n);
      const size = pdfPage.getViewport({ scale: PT_TO_UNITS });
      const viewport = pdfPage.getViewport({ scale: PT_TO_UNITS * RENDER_SCALE });

      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d")!;
      // JPEG has no transparency; give transparent PDFs a white sheet.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await pdfPage.render({ canvasContext: ctx, canvas, viewport }).promise;
      pdfPage.cleanup();

      const asset = contentManager.addAsset(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      pages.push({
        ...template,
        name: doc.numPages > 1 ? `${baseName} (${n})` : baseName,
        width: Math.round(size.width),
        height: Math.round(size.height),
        pattern: null,
        background_color: "#ffffff",
        background_asset: asset,
        layers: [
          { id: crypto.randomUUID(), name: "Layer 1", blocks: [], visible: true, locked: false },
        ],
      });
    }

    await doc.destroy();
    contentManager.appendPages(pages, "Import PDF");
    popupManager.add({
      type: "success",
      message: `Added ${pages.length} page${pages.length === 1 ? "" : "s"} from "${file.name}".`,
    });
  } catch (e) {
    console.error(e);
    popupManager.add({
      type: "destructive",
      message: `"${file.name}" could not be imported as a PDF.`,
    });
  }
}
