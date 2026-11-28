import { encodeCanvas } from "#lib/util/encode.ts";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import { canvasManager } from "#lib/editor/state/canvasManager.svelte.ts";
import { lassoManager } from "#lib/editor/state/lassoManager.svelte.ts";
import { selectionFromIds } from "#lib/editor/tools/lasso.ts";
import { contentManager } from "#lib/state/contentManager.svelte.ts";
import { defaultsStore } from "#lib/state/defaultsStore.svelte.ts";
import { popupManager } from "#lib/state/popupManager.svelte.ts";
import { tabManager } from "#lib/state/tabManager.svelte.ts";
import type { Block, Page } from "#lib/tauri/bindings.ts";
import { newId } from "../blocks";
import { pageRect } from "../pageFormats";
import { detectScan, PT_TO_UNITS, sizeFactor, type PdfSizing } from "./pdfScale";

/*
 * PDF import in steps, so a dialog can sit in between:
 *
 *   openPdf(file)           load once (pdf.js is loaded on first use only)
 *   source.thumbnail(n)     small previews for choosing pages
 *   importPdfPages(...)     render the chosen pages and insert them, either
 *                           as new pages (PDF page as background, ready to
 *                           write on) or as images on the current page
 *   source.close()          release the document and pdf.js worker
 */

/** Render at twice the page's size so slides stay sharp when zoomed in. */
const RENDER_SCALE = 2;
const JPEG_QUALITY = 0.88;

export interface PdfSource {
  /** File name without ".pdf". */
  name: string;
  numPages: number;
  /** A small preview of page `n` (1-based) as a data URL. */
  thumbnail(n: number, maxPx: number): Promise<string>;
  /** Page `n`'s size as stored, in points (rotation applied). */
  pageSize(n: number): Promise<{ width: number; height: number }>;
  close(): Promise<void>;
  /** @internal */
  doc: PDFDocumentProxy;
}

export async function openPdf(file: File): Promise<PdfSource> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  // The loading task owns the document and its worker; destroying it in
  // close() releases both.
  const task: PDFDocumentLoadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
  let doc: PDFDocumentProxy;
  try {
    doc = await task.promise;
  } catch (e) {
    await task.destroy();
    throw e;
  }

  return {
    name: file.name.replace(/\.pdf$/i, ""),
    numPages: doc.numPages,
    doc,
    async thumbnail(n, maxPx) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const r = await render(doc, n, maxPx / Math.max(base.width, base.height), "image/png");
      return r.dataUrl;
    },
    async pageSize(n) {
      const v = (await doc.getPage(n)).getViewport({ scale: 1 });
      return { width: v.width, height: v.height };
    },
    close: () => task.destroy(),
  };
}

/**
 * Renders page `n` onto a white sheet at `scale` pixels per point. The size
 * returned is in content units, times `factor` (see pdfScale.ts).
 */
async function render(
  doc: PDFDocumentProxy,
  n: number,
  scale: number,
  type: "image/png" | "image/jpeg" = "image/jpeg",
  factor = 1,
) {
  const page = await doc.getPage(n);
  const size = page.getViewport({ scale: PT_TO_UNITS * factor });
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  const ctx = canvas.getContext("2d")!;
  // JPEG has no transparency; give transparent PDFs a white sheet.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, canvas, viewport }).promise;
  page.cleanup();

  return {
    dataUrl: await encodeCanvas(canvas, type, JPEG_QUALITY),
    width: Math.round(size.width),
    height: Math.round(size.height),
  };
}

export type PdfDestination =
  /** One new page per PDF page, the PDF page as its background. */
  | { kind: "pages"; at: "after" | "end" }
  /** The PDF pages as images on the current page, stacked top to bottom. */
  | { kind: "here" };

const STACK_GAP = 24;
const MARGIN = 32;

/**
 * Renders the chosen pages and inserts them in one undo step, sized by
 * `sizing`. Reports progress as (done, total). Returns whether anything was
 * inserted.
 */
export async function importPdfPages(
  src: PdfSource,
  pages: number[],
  dest: PdfDestination,
  onProgress?: (done: number, total: number) => void,
  sizing: PdfSizing = { kind: "keep" },
): Promise<boolean> {
  const tab = tabManager.tab;
  if (pages.length === 0 || !tab) return false;

  if (dest.kind === "here") {
    const layer = contentManager.layers[contentManager.activeLayer];
    if (!layer || layer.locked || !layer.visible) {
      popupManager.add({ type: "warning", message: "The active layer is locked or hidden." });
      return false;
    }
  }

  // Render everything first, so the insert itself is one quick, atomic step.
  // Each page goes to the backend as soon as it is rendered, so the renders
  // don't pile up in memory.
  const rendered: { n: number; asset: string; width: number; height: number }[] = [];
  for (const [i, n] of pages.entries()) {
    onProgress?.(i, pages.length);
    const pt = await src.pageSize(n);
    const factor = sizeFactor(sizing, pt.width, pt.height);
    // A scan holds one image pixel per point: render exactly that, whatever
    // size the page gets. More pixels add nothing; fewer would lose detail.
    const scale = detectScan(pt.width, pt.height) ? 1 : PT_TO_UNITS * RENDER_SCALE * factor;
    const { dataUrl, width, height } = await render(src.doc, n, scale, "image/jpeg", factor);
    const asset = await contentManager.addAsset(dataUrl, tab);
    if (!asset) return false;
    rendered.push({ n, asset, width, height });
  }
  onProgress?.(pages.length, pages.length);

  // The note may have been switched or closed while rendering.
  if (tabManager.tab !== tab) {
    popupManager.add({
      type: "warning",
      message: "The PDF wasn't imported because the note was closed or switched meanwhile.",
    });
    return false;
  }

  const label = `Import ${pages.length === 1 ? "PDF page" : "PDF pages"}`;

  if (dest.kind === "pages") {
    const template = $state.snapshot(defaultsStore.store.page);
    const newPages: Page[] = rendered.map((r) => ({
      ...template,
      name: src.numPages > 1 ? `${src.name} (${r.n})` : src.name,
      width: r.width,
      height: r.height,
      pattern: null,
      background_color: "#ffffff",
      background_asset: r.asset,
      regions: [],
      created_at: Date.now(),
      layers: [{ id: crypto.randomUUID(), name: "Layer 1", blocks: [], visible: true, locked: false }],
    }));
    const at = dest.at === "after" ? contentManager.currentPage + 1 : contentManager.pages.length;
    contentManager.insertPages(newPages, at, label);
    return true;
  }

  // On this page: images stacked downwards from the top of the view,
  // shrunk to fit the sheet (or the view on an infinite page).
  const view = canvasManager.viewBounds();
  const sheet = pageRect(contentManager.page);
  const maxWidth = (sheet ? sheet.width : view.width * 0.8) - (sheet ? MARGIN * 2 : 0);
  const centreX = sheet ? sheet.min.x + sheet.width / 2 : view.min.x + view.width / 2;
  let y = Math.max(view.min.y + MARGIN, sheet ? sheet.min.y + MARGIN : -Infinity);

  const blocks: Block[] = rendered.map((r) => {
    const k = Math.min(1, maxWidth / r.width);
    const width = r.width * k;
    const height = r.height * k;
    const block: Block = {
      type: "Image",
      id: newId(),
      asset: r.asset,
      x: centreX - width / 2,
      y,
      width,
      height,
    };
    y += height + STACK_GAP;
    return block;
  });

  tabManager.transact(label, () => {
    const layer = contentManager.layers[contentManager.activeLayer];
    layer.blocks = [...layer.blocks, ...blocks];
    // Select them, so they can be moved right away.
    canvasManager.tool = "lasso";
    lassoManager.selection = selectionFromIds(blocks.map((b) => b.id)) ?? undefined;
    lassoManager.isSelecting = !lassoManager.selection;
  });
  return true;
}
