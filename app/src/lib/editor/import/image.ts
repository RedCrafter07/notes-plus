import { canvasManager } from "#lib/editor/state/canvasManager.svelte.ts";
import { lassoManager } from "#lib/editor/state/lassoManager.svelte.ts";
import { selectionFromIds } from "#lib/editor/tools/lasso.ts";
import { contentManager } from "#lib/state/contentManager.svelte.ts";
import { popupManager } from "#lib/state/popupManager.svelte.ts";
import { tabManager } from "#lib/state/tabManager.svelte.ts";
import { newId } from "../blocks";
import { pageRect } from "../pageFormats";

/** Longest edge, in pixels, an inserted image is stored at. */
const MAX_PIXELS = 2400;

export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function decode(src: string) {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

/**
 * Downscales huge photos before storing them: a 12 MP phone photo would
 * otherwise bloat the note (and every autosave) for no visible benefit.
 */
async function normalize(file: File): Promise<{ src: string; w: number; h: number }> {
  const src = await readAsDataUrl(file);
  const img = await decode(src);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const scale = Math.min(1, MAX_PIXELS / Math.max(w, h));
  if (scale === 1) return { src, w, h };

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  return { src: canvas.toDataURL(type, 0.9), w: canvas.width, h: canvas.height };
}

/**
 * Places an image in the middle of the visible part of the page, sized to
 * fit comfortably, then selects it so it can be moved right away.
 */
export async function insertImageFile(file: File) {
  const layer = contentManager.layers[contentManager.activeLayer];
  if (!layer || layer.locked || !layer.visible) {
    popupManager.add({ type: "warning", message: "The active layer is locked or hidden." });
    return;
  }

  let image;
  try {
    image = await normalize(file);
  } catch {
    popupManager.add({ type: "warning", message: `"${file.name}" is not an image that can be opened.` });
    return;
  }

  const tab = tabManager.tab;
  const asset = await contentManager.addAsset(image.src, tab);
  if (!asset || tabManager.tab !== tab) return;

  const view = canvasManager.viewBounds();
  const page = pageRect(contentManager.page);
  const area = page ?? view;
  const maxW = Math.min(area.width, view.width) * 0.6;
  const maxH = Math.min(area.height, view.height) * 0.6;
  const scale = Math.min(1, maxW / image.w, maxH / image.h);
  const width = image.w * scale;
  const height = image.h * scale;
  const cx = (view.min.x + view.max.x) / 2;
  const cy = (view.min.y + view.max.y) / 2;

  const id = newId();
  tabManager.transact("Insert image", () => {
    layer.blocks = [
      ...layer.blocks,
      { type: "Image", id, asset, x: cx - width / 2, y: cy - height / 2, width, height },
    ];
    canvasManager.tool = "lasso";
    lassoManager.selection = selectionFromIds([id]) ?? undefined;
    lassoManager.isSelecting = !lassoManager.selection;
  });
}

/** Opens the system file picker and resolves with the chosen files. */
export function pickFiles(accept: string, multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = () => resolve([...(input.files ?? [])]);
    input.oncancel = () => resolve([]);
    input.click();
  });
}
