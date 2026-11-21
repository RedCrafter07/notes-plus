<script lang="ts">
  import {
    IconChevronLeft,
    IconChevronRight,
    IconFocus2,
    IconMinus,
    IconPlus,
    IconLayoutGrid,
    IconSettings,
  } from "@tabler/icons-svelte";
  import { contentManager } from "#lib/state/contentManager.svelte.ts";
  import { overlayManager } from "#lib/state/overlayManager.svelte.ts";
  import { canvasManager } from "./state/canvasManager.svelte";
  import { isInfinite } from "./pageFormats";

  const btn =
    "w-11 h-11 grid place-items-center rounded-xl text-content-2 transition-all hover:bg-overlay/30 hover:text-content-1 active:scale-90 disabled:opacity-30 disabled:pointer-events-none";

  const pageCount = $derived(contentManager.pages.length);
  const current = $derived(contentManager.currentPage);
  const atEnd = $derived(current === pageCount - 1);

  function zoomBy(f: number) {
    canvasManager.zoomAround(canvasManager.width / 2, canvasManager.height / 2, f);
  }
</script>

<!-- Zoom: always visible, so "where did my page go" always has an answer. -->
<div
  class="absolute bottom-3 left-3 z-20 flex flex-row items-center gap-0.5 p-1 rounded-2xl bg-base-1/80 backdrop-blur-md shadow-lg border border-content-1/10"
>
  <button class={btn} onclick={() => zoomBy(1 / 1.25)} aria-label="Zoom out" title="Zoom out">
    <IconMinus size={20} />
  </button>
  <button
    class="h-11 px-1 min-w-14 rounded-xl text-sm font-semibold tabular-nums text-content-2 hover:bg-overlay/30 active:scale-95 transition-all"
    onclick={() => canvasManager.fitPage()}
    title={isInfinite(contentManager.page) ? "Fit to content" : "Fit page"}
  >
    {Math.round(contentManager.zoom * 100)}%
  </button>
  <button class={btn} onclick={() => zoomBy(1.25)} aria-label="Zoom in" title="Zoom in">
    <IconPlus size={20} />
  </button>
  <button
    class={btn}
    onclick={() => canvasManager.fitPage()}
    aria-label={isInfinite(contentManager.page) ? "Fit to content" : "Fit page"}
    title={isInfinite(contentManager.page) ? "Fit to content (Ctrl+0)" : "Fit page (Ctrl+0)"}
  >
    <IconFocus2 size={20} />
  </button>
</div>

<!-- Pages: previous / where am I / next (or add, on the last page). -->
<div
  class="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex flex-row items-center gap-0.5 p-1 rounded-2xl bg-base-1/80 backdrop-blur-md shadow-lg border border-content-1/10"
>
  <button
    class={btn}
    disabled={current === 0}
    onclick={() => (contentManager.currentPage = current - 1)}
    aria-label="Previous page"
    title="Previous page (Page Up)"
  >
    <IconChevronLeft />
  </button>
  <button
    class="h-11 px-3 rounded-xl text-sm font-semibold text-content-2 hover:bg-overlay/30 active:scale-95 transition-all flex flex-row gap-2 items-center"
    onclick={() => overlayManager.setOpen("pages")}
    title="All pages (Ctrl+G)"
  >
    <IconLayoutGrid size={18} class="opacity-60" />
    <span class="tabular-nums">{current + 1} / {pageCount}</span>
  </button>
  <button
    class={btn}
    onclick={() => overlayManager.setOpen(`pagesettings-${current}`)}
    aria-label="Page setup"
    title="Page setup"
  >
    <IconSettings size={20} />
  </button>
  {#if atEnd}
    <button
      class={btn}
      onclick={() => contentManager.addPage()}
      aria-label="Add page"
      title="Add page"
    >
      <IconPlus />
    </button>
  {:else}
    <button
      class={btn}
      onclick={() => (contentManager.currentPage = current + 1)}
      aria-label="Next page"
      title="Next page (Page Down)"
    >
      <IconChevronRight />
    </button>
  {/if}
</div>

