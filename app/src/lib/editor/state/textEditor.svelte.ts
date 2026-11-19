import { contentManager } from "$lib/state/contentManager.svelte";
import { tabManager } from "$lib/state/tabManager.svelte";
import type { Point } from "$lib/tauri/bindings";
import { blockBounds, newId, type TextBlock } from "../blocks";
import { requestRedraw } from "../render/scheduler";

export interface TextDraft {
  layerId: string;
  /** The block being edited; `undefined` for a new one. */
  original?: TextBlock;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  color: string;
  text: string;
}

const DEFAULT_WIDTH = 360;

/*
 * Editing happens in a <textarea> laid over the canvas; the block itself is
 * hidden while its draft is open. Committing replaces the original block with
 * a new one (new id) at the same index, keeping the "never mutate a block in
 * place" invariant that history and the render caches rely on.
 */
class TextEditor {
  draft = $state<TextDraft>();

  /** Id of the block hidden from the canvas while it is edited. */
  get hiddenId() {
    return this.draft?.original?.id;
  }

  /** Topmost text block under `p` on a visible, unlocked layer. */
  hitTest(p: Point): { layerId: string; block: TextBlock } | undefined {
    const layers = contentManager.layers;
    for (let li = layers.length - 1; li >= 0; li--) {
      const l = layers[li];
      if (!l.visible || l.locked) continue;
      for (let i = l.blocks.length - 1; i >= 0; i--) {
        const b = l.blocks[i];
        if (b.type !== "Text") continue;
        const r = blockBounds(b);
        if (r && p.x >= r.min.x && p.x <= r.max.x && p.y >= r.min.y && p.y <= r.max.y)
          return { layerId: l.id, block: b };
      }
    }
  }

  edit(layerId: string, block: TextBlock) {
    this.draft = {
      layerId,
      original: block,
      x: block.x,
      y: block.y,
      width: block.width,
      fontSize: block.font_size,
      color: block.color,
      text: block.text,
    };
    requestRedraw();
  }

  create(p: Point, fontSize: number, color: string) {
    const layer = contentManager.layers[contentManager.activeLayer];
    if (!layer || layer.locked || !layer.visible) return;

    // Fit the box inside a fixed page instead of running off its edge.
    const page = contentManager.page;
    const maxWidth = page.width > 0 ? page.width - p.x - 16 : Infinity;

    this.draft = {
      layerId: layer.id,
      x: p.x,
      // Put the first line's centre at the tap, not its top.
      y: p.y - fontSize * 0.7,
      width: Math.max(80, Math.min(DEFAULT_WIDTH, maxWidth)),
      fontSize,
      color,
      text: "",
    };
  }

  commit() {
    const d = this.draft;
    if (!d) return;
    this.draft = undefined;

    const text = d.text.replace(/\s+$/, "");
    const unchanged =
      d.original &&
      d.original.text === text &&
      d.original.width === d.width &&
      d.original.x === d.x &&
      d.original.y === d.y;

    if (unchanged || (!d.original && text === "")) {
      requestRedraw();
      return;
    }

    tabManager.transact(d.original ? "Edit text" : "Add text", () => {
      const layer = contentManager.layers.find((l) => l.id === d.layerId);
      if (!layer) return;

      const blocks = [...layer.blocks];
      const index = d.original
        ? blocks.findIndex((b) => b.id === d.original!.id)
        : -1;

      const next: TextBlock = {
        type: "Text",
        id: newId(),
        x: d.x,
        y: d.y,
        width: d.width,
        text,
        font_size: d.fontSize,
        color: d.color,
      };

      if (index === -1) {
        if (text !== "") blocks.push(next);
      } else if (text === "") {
        blocks.splice(index, 1); // emptied: delete
      } else {
        blocks[index] = next;
      }

      layer.blocks = blocks;
    });
  }

  cancel() {
    this.draft = undefined;
    requestRedraw();
  }
}

export const textEditor = new TextEditor();
