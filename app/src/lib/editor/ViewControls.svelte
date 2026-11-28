<script lang="ts">
  import {
    IconChevronLeft,
    IconChevronRight,
    IconFocus2,
    IconMinus,
    IconPlus,
    IconLayoutGrid,
    IconSettings,
    IconMoon,
    IconSun,
    IconStar,
    IconStarFilled,
  } from "@tabler/icons-svelte";
  import { settingsStore, updateSettings } from "#lib/state/settingsStore.svelte.ts";
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

  /*
   * The percentage: a tap goes back to 100 % (fitting the page is the focus
   * button). To type a zoom: double-click or right-click it, or hold it
   * with a pen or finger (a double tap with a pen is unreliable). Enter or
   * leaving the field applies; Escape cancels.
   */
  const HOLD_MS = 450;
  let editing = $state(false);
  let draft = $state("");
  let holdTimer = 0;
  let held = false;

  // The field opens empty, with the current zoom as placeholder: typing
  // enters the new value directly, without depending on a selection to
  // replace (a lost selection appends: "100" + "150" = 3200 % after
  // clamping). Empty means no change.
  function startEdit() {
    clearTimeout(holdTimer);
    draft = "";
    editing = true;
  }

  function finishEdit(apply: boolean) {
    if (!editing) return;
    editing = false;
    const percent = parseFloat(draft.replace(",", "."));
    if (apply && Number.isFinite(percent) && percent > 0) canvasManager.zoomTo(percent / 100);
  }

  function holdStart(e: PointerEvent) {
    held = false;
    if (e.pointerType === "mouse") return;
    holdTimer = window.setTimeout(() => {
      held = true;
      startEdit();
    }, HOLD_MS);
  }

  function focusField(node: HTMLInputElement) {
    node.focus();
  }
</script>

<!-- Zoom: always visible, so "where did my page go" always has an answer. -->
<div
  class="absolute bottom-3 left-3 z-20 flex flex-row items-center gap-0.5 p-1 rounded-2xl bg-base-1/80 backdrop-blur-md shadow-lg border border-content-1/10"
>
  <button class={btn} onclick={() => zoomBy(1 / 1.25)} aria-label="Zoom out" title="Zoom out">
    <IconMinus size={20} />
  </button>
  {#if editing}
    <label class="h-11 min-w-14 px-1 flex flex-row items-center rounded-xl bg-base-3 ring-2 ring-primary">
      <input
        use:focusField
        class="w-10 bg-transparent text-sm font-semibold tabular-nums text-content-1 text-right outline-none placeholder:text-content-3"
        inputmode="decimal"
        aria-label="Zoom in percent"
        placeholder={String(Math.round(contentManager.zoom * 100))}
        bind:value={draft}
        onkeydown={(e) => {
          if (e.key === "Enter") finishEdit(true);
          else if (e.key === "Escape") finishEdit(false);
        }}
        onblur={() => finishEdit(true)}
      />
      <span class="text-sm font-semibold text-content-2">%</span>
    </label>
  {:else}
    <button
      class="h-11 px-1 min-w-14 rounded-xl text-sm font-semibold tabular-nums text-content-2 hover:bg-overlay/30 active:scale-95 transition-all"
      onpointerdown={holdStart}
      onpointerup={() => clearTimeout(holdTimer)}
      onpointerleave={() => clearTimeout(holdTimer)}
      onclick={() => {
        if (held) return; // the hold already opened the field
        canvasManager.zoomTo(1);
      }}
      ondblclick={startEdit}
      oncontextmenu={(e) => {
        e.preventDefault();
        startEdit();
      }}
      aria-label="Zoom {Math.round(contentManager.zoom * 100)} percent. Tap for 100 percent, hold or double-click to type a zoom"
      title="100 % (hold, double- or right-click to type a zoom)"
    >
      {Math.round(contentManager.zoom * 100)}%
    </button>
  {/if}
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
  <button
    class={btn}
    onclick={() => updateSettings({ dark_pages: !settingsStore.store.dark_pages })}
    aria-label={settingsStore.store.dark_pages ? "Show pages light" : "Show pages dark"}
    aria-pressed={settingsStore.store.dark_pages}
    title={settingsStore.store.dark_pages
      ? "Show pages in their real colours"
      : "Show pages dark (only on screen; exports stay as they are)"}
  >
    {#if settingsStore.store.dark_pages}<IconSun size={20} />{:else}<IconMoon size={20} />{/if}
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
    class={[btn, contentManager.page.bookmarked && "text-warning"]}
    onclick={() => contentManager.toggleBookmark(current)}
    aria-label={contentManager.page.bookmarked ? "Remove bookmark" : "Bookmark this page"}
    aria-pressed={!!contentManager.page.bookmarked}
    title={contentManager.page.bookmarked
      ? "Remove the bookmark"
      : "Bookmark this page (jump to it from the Pages panel)"}
  >
    {#if contentManager.page.bookmarked}<IconStarFilled size={20} />{:else}<IconStar size={20} />{/if}
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

