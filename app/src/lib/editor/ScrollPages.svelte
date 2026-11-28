<script lang="ts">
  import { contentManager } from "#lib/state/contentManager.svelte.ts";
  import { settingsStore } from "#lib/state/settingsStore.svelte.ts";
  import type { Page } from "#lib/tauri/bindings.ts";
  import type { Attachment } from "svelte/attachments";
  import { displayPaper } from "./inkColor";
  import { cachedImage, imageKey, imageScale, renderImage } from "./render/pageImages";
  import { offsetFrom } from "./scrollLayout";
  import { canvasManager } from "./state/canvasManager.svelte";

  /*
   * Scroll mode: the pages above and below the current one, as rendered
   * images at their place in the column (scrollLayout.ts). Only those in
   * view are shown. An image keeps showing (scaled) while the zoom changes,
   * and is rendered again sharply once it settles.
   */

  /** Wait this long after the zoom settles before rendering sharper. */
  const SETTLE_MS = 200;

  const slots = $derived(canvasManager.column);
  const cur = $derived(contentManager.currentPage);
  const zoom = $derived(contentManager.zoom);

  const visible = $derived.by(() => {
    if (!slots) return [];
    const view = canvasManager.viewBounds();
    return slots.flatMap((s, j) => {
      if (j === cur) return [];
      const o = offsetFrom(slots, cur, j);
      const inView =
        o.x < view.max.x && o.x + s.width > view.min.x && o.y < view.max.y && o.y + s.height > view.min.y;
      if (!inView) return [];
      const at = canvasManager.translateToAbsolute(o);
      return [{ j, page: contentManager.pages[j], x: at.x, y: at.y, w: s.width * zoom, h: s.height * zoom }];
    });
  });

  /** Shows the page's image in the element, rendering it (again) when needed. */
  function pageImage(page: Page, scale: number, darkPages: boolean, dates: boolean): Attachment<HTMLElement> {
    return (node) => {
      const paper = displayPaper(page.background_color, page.pattern_color, darkPages);
      const key = imageKey(scale, `${paper.background}|${paper.pattern}|${paper.inverted}|${dates}`);
      const cached = cachedImage(page);
      if (cached) node.replaceChildren(cached.canvas);
      if (cached?.key === key) return;

      let cancelled = false;
      const timer = setTimeout(
        async () => {
          const shown = { ...page, background_color: paper.background, pattern_color: paper.pattern };
          const image = await renderImage(page, shown, contentManager.assets, scale, key, paper.inverted);
          if (!cancelled && image) node.replaceChildren(image.canvas);
        },
        cached ? SETTLE_MS : 0,
      );
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    };
  }
</script>

{#each visible as v (v.page.id)}
  <div
    class="absolute pointer-events-none shadow-[0_2px_16px_rgba(0,0,0,0.45)]"
    style="left: {v.x}px; top: {v.y}px; width: {v.w}px; height: {v.h}px; background-color: {displayPaper(v.page.background_color, v.page.pattern_color, settingsStore.store.dark_pages).background};"
    {@attach pageImage(
      v.page,
      imageScale(v.page, zoom, canvasManager.dpr),
      settingsStore.store.dark_pages,
      settingsStore.store.page_dates,
    )}
  ></div>
{/each}
