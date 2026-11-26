<script lang="ts">
  import { encodeCanvas } from "#lib/util/encode.ts";
  import { contentManager } from "#lib/state/contentManager.svelte.ts";
  import type { Page } from "#lib/tauri/bindings.ts";
  import type { ContentBounds } from "#lib/util/canvasBounds.ts";
  import { renderArea } from "../render/page";

  /** A rendered rectangle of a page, re-rendered (debounced) when it changes. */
  let {
    page,
    area,
    pixelWidth,
    paper = true,
    only,
  }: {
    page: Page;
    area: ContentBounds;
    /** Render width in device pixels; height follows the area's ratio. */
    pixelWidth: number;
    paper?: boolean;
    only?: Set<string>;
  } = $props();

  let src = $state<string>();

  $effect(() => {
    for (const l of page.layers) void l.blocks;
    const a = { ...area.min, w: area.width, h: area.height };
    const w = Math.max(1, Math.round(pixelWidth));
    const opts = { paper, only };

    const timer = setTimeout(async () => {
      const canvas = await renderArea(page, contentManager.assets, area, {
        width: w,
        height: (w * a.h) / a.w,
        ...opts,
      });
      src = canvas ? await encodeCanvas(canvas) : undefined;
    }, 120);
    return () => clearTimeout(timer);
  });
</script>

{#if src}
  <img {src} alt="" draggable="false" class="block w-full h-full pointer-events-none select-none" />
{/if}
