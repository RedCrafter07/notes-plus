import { contentManager } from "$lib/state/contentManager.svelte";
import { popupManager } from "$lib/state/popupManager.svelte";
import { commands } from "$lib/tauri/bindings";
import { renderArea, renderPage } from "../render/page";
import { buildPdf, type PdfPage } from "./pdfWriter";

/** Pixels per content unit: 2 ≈ 192 dpi, sharp in print and on screen. */
const EXPORT_SCALE = 2;
const UNITS_TO_PT = 72 / 96;

function toBase64(bytes: Uint8Array) {
  let s = "";
  const CHUNK = 0x8000; // stay under the argument limit of fromCharCode
  for (let i = 0; i < bytes.length; i += CHUNK)
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(s);
}

async function canvasBytes(canvas: HTMLCanvasElement, type: string, quality?: number) {
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, quality));
  if (!blob) throw new Error("Encoding failed");
  return new Uint8Array(await blob.arrayBuffer());
}

function fileName(ext: string) {
  const safe = contentManager.title.replace(/[\\/:*?"<>|]+/g, "-").trim() || "Note";
  return `${safe}.${ext}`;
}

async function save(bytes: Uint8Array, name: string, filter: string, ext: string) {
  const path = await commands.exportFile(toBase64(bytes), name, filter, ext);
  if (path) popupManager.add({ type: "success", message: `Exported to ${path}` });
}

/** Exports one page as a PNG. */
export async function exportPagePng(index = contentManager.currentPage) {
  const page = contentManager.pages[index];
  const canvas = page && (await renderPage(page, contentManager.assets, { scale: EXPORT_SCALE }));
  if (!canvas) {
    popupManager.add({ type: "warning", message: "This page is empty." });
    return;
  }
  await save(await canvasBytes(canvas, "image/png"), fileName("png"), "PNG image", "png");
}

/** Exports every page (empty infinite pages are skipped) as one PDF. */
export async function exportPdf() {
  const pages: PdfPage[] = [];

  for (const page of contentManager.pages) {
    const area = renderArea(page);
    const canvas = await renderPage(page, contentManager.assets, { scale: EXPORT_SCALE });
    if (!area || !canvas) continue;

    pages.push({
      jpeg: await canvasBytes(canvas, "image/jpeg", 0.92),
      pixelWidth: canvas.width,
      pixelHeight: canvas.height,
      width: area.width * UNITS_TO_PT,
      height: area.height * UNITS_TO_PT,
    });
  }

  if (pages.length === 0) {
    popupManager.add({ type: "warning", message: "There is nothing to export yet." });
    return;
  }
  await save(buildPdf(pages), fileName("pdf"), "PDF document", "pdf");
}
