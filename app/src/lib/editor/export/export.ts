import { lassoManager } from "#lib/editor/state/lassoManager.svelte.ts";
import { contentManager } from "#lib/state/contentManager.svelte.ts";
import { popupManager } from "#lib/state/popupManager.svelte.ts";
import { commands, type Page } from "#lib/tauri/bindings.ts";
import { boundsFromRect, type ContentBounds } from "#lib/util/canvasBounds.ts";
import { assetDataUrl, type Assets } from "../assets";
import { usedAssets } from "../blocks";
import { pageArea, renderArea } from "../render/page";
import { areaToSvg } from "../render/svg";
import { buildPdf, type PdfPage } from "./pdfWriter";
import { nominalSize, regionBounds } from "./regions";

export type ExportMode = "pages" | "selection" | "regions";
export type ExportFormat = "pdf" | "png" | "jpg" | "svg";

/** What one output page/file is made of. */
export interface ExportJob {
  name: string;
  page: Page;
  /** The part of the page to render, in content units. */
  area: ContentBounds;
  /** Output size at 1x, in content units (96 per inch). */
  size: { width: number; height: number };
  /** Only these blocks (selection export). */
  only?: Set<string>;
}

export interface ExportOptions {
  mode: ExportMode;
  /** For "pages": every page, or just the open one. */
  pages: "all" | "current";
  format: ExportFormat;
  /** Pixels per content unit for PNG/JPG/PDF. */
  scale: number;
  /** Include paper colour, ruling and PDF backgrounds. */
  paper: boolean;
}

const UNITS_TO_PT = 72 / 96;
const SELECTION_MARGIN = 16;

export const FORMAT_INFO: Record<ExportFormat, { label: string; filter: string; mime: string }> = {
  pdf: { label: "PDF", filter: "PDF document", mime: "application/pdf" },
  png: { label: "PNG", filter: "PNG image", mime: "image/png" },
  jpg: { label: "JPG", filter: "JPEG image", mime: "image/jpeg" },
  svg: { label: "SVG", filter: "SVG image", mime: "image/svg+xml" },
};

/** Turns the chosen mode into a list of things to render. */
export function planJobs(opts: Pick<ExportOptions, "mode" | "pages">): ExportJob[] {
  const pages = contentManager.pages;

  switch (opts.mode) {
    case "pages": {
      const indices =
        opts.pages === "all" ? pages.map((_, i) => i) : [contentManager.currentPage];
      return indices.flatMap((i) => {
        const area = pageArea(pages[i]);
        return area
          ? [{ name: pages[i].name, page: pages[i], area, size: { width: area.width, height: area.height } }]
          : [];
      });
    }
    case "selection": {
      const b = lassoManager.boundingBox;
      if (!lassoManager.selection || !b || b.width === 0) return [];
      const m = SELECTION_MARGIN;
      const area = boundsFromRect(b.x - m, b.y - m, b.width + 2 * m, b.height + 2 * m);
      return [
        {
          name: "Selection",
          page: contentManager.page,
          area,
          size: { width: area.width, height: area.height },
          only: new Set(lassoManager.selectedIds),
        },
      ];
    }
    case "regions":
      // Export order: page order, then each page's own region order.
      return pages.flatMap((page) =>
        page.regions.map((r) => ({
          name: r.name,
          page,
          area: regionBounds(r),
          size: nominalSize(r),
        })),
      );
  }
}

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

function baseName() {
  return contentManager.title.replace(/[\\/:*?"<>|]+/g, "-").trim() || "Note";
}

/**
 * The page's attachments as data URLs, so an SVG file stands on its own
 * (inside the app they are `rnasset:` URLs, meaningless anywhere else).
 */
async function embeddedAssets(page: Page): Promise<Assets> {
  const urls = contentManager.assets;
  const data = new Map<string, string>();
  await Promise.all(
    [...usedAssets([page])].map(async (id) => {
      const url = await assetDataUrl(urls(id));
      if (url) data.set(id, url);
    }),
  );
  return (id) => data.get(id);
}

async function raster(job: ExportJob, o: ExportOptions, opaque: boolean) {
  return renderArea(job.page, contentManager.assets, job.area, {
    width: job.size.width * o.scale,
    height: job.size.height * o.scale,
    paper: o.paper,
    // JPEG and PDF have no transparency: without paper, use white.
    fill: opaque ? "#ffffff" : undefined,
  });
}

/**
 * Renders and saves. PDF is always one file (one page per job); images are
 * one file per job, written into a chosen folder when there are several.
 * Returns whether anything was written.
 */
export async function runExport(o: ExportOptions): Promise<boolean> {
  const jobs = planJobs(o);
  if (jobs.length === 0) {
    popupManager.add({ type: "warning", message: "There is nothing to export." });
    return false;
  }

  const ext = o.format;
  const info = FORMAT_INFO[ext];
  const base = baseName();

  if (ext === "pdf") {
    const pages: PdfPage[] = [];
    for (const job of jobs) {
      const canvas = await raster(job, o, true);
      if (!canvas) continue;
      pages.push({
        jpeg: await canvasBytes(canvas, "image/jpeg", 0.92),
        pixelWidth: canvas.width,
        pixelHeight: canvas.height,
        width: job.size.width * UNITS_TO_PT,
        height: job.size.height * UNITS_TO_PT,
      });
    }
    return done(await commands.exportFile(toBase64(buildPdf(pages)), `${base}.pdf`, info.filter, ext));
  }

  const files: { name: string; data_base64: string }[] = [];
  for (const [i, job] of jobs.entries()) {
    let bytes: Uint8Array;
    if (ext === "svg") {
      const assets = await embeddedAssets(job.page);
      const svg = areaToSvg(job.page, assets, job.area, { paper: o.paper, only: job.only });
      bytes = new TextEncoder().encode(svg);
    } else {
      const canvas = await raster(job, o, ext === "jpg");
      if (!canvas) continue;
      bytes = await canvasBytes(canvas, info.mime, ext === "jpg" ? 0.92 : undefined);
    }
    const suffix = jobs.length > 1 ? ` - ${String(i + 1).padStart(2, "0")} ${job.name}` : "";
    files.push({ name: `${base}${suffix}.${ext}`, data_base64: toBase64(bytes) });
  }

  if (files.length === 1)
    return done(await commands.exportFile(files[0].data_base64, files[0].name, info.filter, ext));
  return done(await commands.exportFiles(files), files.length);
}

function done(path: string | null, count = 1) {
  if (path)
    popupManager.add({
      type: "success",
      message: count > 1 ? `Exported ${count} files to ${path}` : `Exported to ${path}`,
    });
  return !!path;
}
