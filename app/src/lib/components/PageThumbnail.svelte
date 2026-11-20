<script lang="ts">
  import { renderPage } from "#lib/editor/render/page.ts";
  import { contentManager } from "#lib/state/contentManager.svelte.ts";
  import type { Page } from "#lib/tauri/bindings.ts";

  let { page }: { page: Page } = $props();

  let src = $state<string>();
  const ratio = $derived(page.width > 0 ? page.width / page.height : 1);

  // Re-render when the page or any layer's blocks change, debounced so
  // drawing does not re-render the thumbnail on every stroke.
  $effect(() => {
    for (const l of page.layers) {
      void l.blocks;
      void l.visible;
    }
    void page.background_color;
    void page.pattern;

    const snapshot = page;
    const timer = setTimeout(async () => {
      const canvas = await renderPage(snapshot, contentManager.assets, { maxSize: 240 });
      src = canvas?.toDataURL("image/png");
    }, 400);
    return () => clearTimeout(timer);
  });
</script>

<div
  class="w-full rounded-md overflow-hidden bg-base-3 grid place-items-center"
  style="aspect-ratio: {Math.max(ratio, 0.5)};"
>
  {#if src}
    <img {src} alt="" class="max-w-full max-h-full object-contain" draggable="false" />
  {:else if page.width < 0}
    <span class="text-xs text-content-3">Empty</span>
  {/if}
</div>
