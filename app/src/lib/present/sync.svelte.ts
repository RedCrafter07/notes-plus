import { canvasManager } from "#lib/editor/state/canvasManager.svelte.ts";
import { laserManager } from "#lib/editor/state/laserManager.svelte.ts";
import { contentManager } from "#lib/state/contentManager.svelte.ts";
import { tabManager } from "#lib/state/tabManager.svelte.ts";
import { presenter } from "./presenter.svelte";

/**
 * Streams the editor to the audience window while presenting. Each kind of
 * data has its own effect, so a pen move only resends the stroke being
 * drawn, not the page. Images are not sent: the audience loads them by URL
 * from the same attachment session.
 *
 * While frozen, nothing but the state is sent, so the audience keeps the
 * last frame. Call once from the editor page.
 */
export function usePresenterSync() {
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

    presenter.send({
      kind: "page",
      page: $state.snapshot(page),
      assets: tabManager.tab?.assets ?? "",
    });
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
      thinning: canvasManager.thinning,
    });
  });

  $effect(() => {
    if (!presenter.active || presenter.frozen) return;
    presenter.send({ kind: "laser", strokes: $state.snapshot(laserManager.strokes) });
  });
}
