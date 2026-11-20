import { canvasManager } from "#lib/editor/state/canvasManager.svelte.ts";
import { laserManager } from "#lib/editor/state/laserManager.svelte.ts";
import { contentManager } from "#lib/state/contentManager.svelte.ts";
import type { Page } from "#lib/tauri/bindings.ts";
import { presenter } from "./presenter.svelte";

/** Asset ids a page draws: its PDF background and any images. */
function pageAssets(page: Page) {
  const ids = new Set<string>();
  if (page.background_asset) ids.add(page.background_asset);
  for (const l of page.layers) for (const b of l.blocks) if (b.type === "Image") ids.add(b.asset);
  return ids;
}

/**
 * Streams the editor to the audience window while presenting. Each kind of
 * data has its own effect, so a pen move only resends the stroke being
 * drawn, not the page; images are sent once per presentation.
 *
 * While frozen, nothing but the state is sent, so the audience keeps the
 * last frame. Call once from the editor page.
 */
export function usePresenterSync() {
  let sentAssets = new Set<string>();

  // A fresh audience window (start, or reload) needs everything again.
  $effect(() => {
    void presenter.resync;
    if (presenter.active) sentAssets = new Set();
  });

  $effect(() => {
    presenter.send({ kind: "state", mode: presenter.mode, blank: presenter.blank });
  });

  // The page: resent when any layer's blocks or the page itself change.
  $effect(() => {
    void presenter.resync;
    if (!presenter.active || presenter.frozen) return;
    const page = contentManager.page;
    for (const l of page.layers) {
      void l.blocks;
      void l.visible;
    }

    const missing: Record<string, string> = {};
    for (const id of pageAssets(page)) {
      const data = contentManager.assets[id];
      if (data && !sentAssets.has(id)) {
        missing[id] = data;
        sentAssets.add(id);
      }
    }
    if (Object.keys(missing).length) presenter.send({ kind: "assets", assets: missing });
    presenter.send({ kind: "page", page: $state.snapshot(page) });
  });

  $effect(() => {
    void presenter.resync;
    if (!presenter.active || presenter.frozen) return;
    presenter.send({
      kind: "view",
      zoom: contentManager.zoom,
      panX: contentManager.panX,
      panY: contentManager.panY,
      width: canvasManager.width,
      height: canvasManager.height,
    });
  });

  // The stroke being drawn, so the audience sees ink appear live.
  $effect(() => {
    if (!presenter.active || presenter.frozen) return;
    const drawing = canvasManager.drawing;
    presenter.send({
      kind: "ink",
      points: drawing ? $state.snapshot(canvasManager.points) : [],
      color: canvasManager.color,
      thickness: canvasManager.thickness,
      opacity: canvasManager.opacity,
    });
  });

  $effect(() => {
    if (!presenter.active || presenter.frozen) return;
    presenter.send({ kind: "laser", strokes: $state.snapshot(laserManager.strokes) });
  });
}
