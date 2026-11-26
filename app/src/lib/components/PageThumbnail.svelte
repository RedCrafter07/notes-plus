<script module lang="ts">
  import type { Page } from "#lib/tauri/bindings.ts";

  /*
   * Rendered thumbnails, shared by the side panel and the page overview, so
   * opening either doesn't render every page again. Keyed by page object;
   * `deps` are what the render depends on, compared by identity (blocks
   * arrays are replaced, never edited, so a new array means new content).
   */
  const cache = new WeakMap<Page, { deps: unknown[]; src: string | undefined }>();

  function deps(page: Page): unknown[] {
    return [
      page.width,
      page.height,
      page.pattern,
      page.pattern_scale,
      page.pattern_color,
      page.background_color,
      page.background_asset,
      ...page.layers.flatMap((l) => [l.blocks, l.visible]),
    ];
  }

  const same = (a: unknown[], b: unknown[]) =>
    a.length === b.length && a.every((x, i) => x === b[i]);
</script>

<script lang="ts">
  import { encodeCanvas } from "#lib/util/encode.ts";
  import { renderPage } from "#lib/editor/render/page.ts";
  import { contentManager } from "#lib/state/contentManager.svelte.ts";

  let { page, maxSize = 240 }: { page: Page; maxSize?: number } = $props();

  let src = $state<string>();
  /** Rendered only once scrolled near the view: a 200-slide deck would
   *  otherwise decode every slide the moment the panel opens. */
  let near = $state(false);
  const ratio = $derived(page.width > 0 ? page.width / page.height : 1);

  function observe(node: HTMLElement) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          near = true;
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(node);
    return { destroy: () => io.disconnect() };
  }

  // Re-render when what is drawn changes, debounced so drawing does not
  // re-render the thumbnail on every stroke.
  $effect(() => {
    if (!near) return;
    const d = [...deps(page), maxSize];
    const hit = cache.get(page);
    if (hit && same(hit.deps, d)) {
      src = hit.src;
      return;
    }

    const snapshot = page;
    const timer = setTimeout(
      async () => {
        const canvas = await renderPage(snapshot, contentManager.assets, { maxSize });
        src = canvas ? await encodeCanvas(canvas) : undefined;
        cache.set(snapshot, { deps: d, src });
      },
      src ? 400 : 0,
    );
    return () => clearTimeout(timer);
  });
</script>

<div
  use:observe
  class="w-full rounded-md overflow-hidden bg-base-3 grid place-items-center"
  style="aspect-ratio: {Math.max(ratio, 0.5)};"
>
  {#if src}
    <img {src} alt="" class="max-w-full max-h-full object-contain" draggable="false" />
  {:else if page.width < 0}
    <span class="text-xs text-content-3">Empty</span>
  {/if}
</div>
