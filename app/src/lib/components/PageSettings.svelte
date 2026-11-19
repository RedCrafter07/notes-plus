<script lang="ts">
  import BackgroundPatterns from "$lib/editor/BackgroundPatterns.svelte";
  import {
    detectFormat,
    formatSize,
    isInfinite,
    PAGE_FORMATS,
    type Orientation,
    type PageFormat,
  } from "$lib/editor/pageFormats";
  import { contentManager, type PageProps } from "$lib/state/contentManager.svelte";
  import { overlayManager } from "$lib/state/overlayManager.svelte";
  import type { BackgroundPattern } from "$lib/tauri/bindings";
  import {
    IconCopy,
    IconInfinity,
    IconRectangle,
    IconRectangleVertical,
    IconStack2,
    IconTrash,
  } from "@tabler/icons-svelte";
  import Input from "./Input.svelte";
  import Overlay from "./Overlay.svelte";
  import ColorInput from "./ColorInput.svelte";

  /*
   * Page setup. Every control applies to the page immediately (and is one
   * undo step), so there is no Apply button to forget; "Apply to all pages"
   * copies this page's setup to the rest of the note.
   */

  const visible = $derived(overlayManager.open?.startsWith("pagesettings-") ?? false);
  const pageIndex = $derived(parseInt(overlayManager.open?.split("-")[1] ?? "0"));
  const page = $derived(contentManager.pages[pageIndex]);

  const detected = $derived(page ? detectFormat(page) : null);
  const orientation = $derived<Orientation>(detected?.orientation ?? "portrait");

  const chip = (active: boolean) =>
    `flex items-center justify-center rounded-xl border-2 transition-all active:scale-95 ${
      active
        ? "border-primary text-content-1 bg-primary/10"
        : "border-content-1/10 bg-base-2 text-content-2 hover:bg-overlay/30 hover:text-content-1"
    }`;
  const action =
    "h-11 w-11 shrink-0 grid place-items-center rounded-xl border-2 transition-all active:scale-95";

  const PAPER_COLORS = [
    { label: "White", bg: "#ffffff", line: "#d4d4d8" },
    { label: "Cream", bg: "#fbf5e6", line: "#d9cfb6" },
    { label: "Grey", bg: "#e9e9ec", line: "#c4c4cc" },
    { label: "Dark", bg: "#1e1e2e", line: "#45475a" },
  ];

  const PATTERNS: { id: BackgroundPattern | null; label: string }[] = [
    { id: null, label: "Blank" },
    { id: "Lines", label: "Ruled" },
    { id: "Squares", label: "Grid" },
    { id: "Dots", label: "Dots" },
  ];

  function set(props: PageProps) {
    contentManager.setPageProps(pageIndex, props);
  }

  function chooseFormat(f: PageFormat) {
    const o = detected?.format.id === f.id ? orientation : f.prefers;
    set(formatSize(f, o));
  }

  function chooseOrientation(o: Orientation) {
    if (!detected?.format.size || o === orientation) return;
    set(formatSize(detected.format, o));
  }

  function applyToAll() {
    if (!page) return;
    contentManager.setPageProps(
      "all",
      {
        width: page.width,
        height: page.height,
        pattern: page.pattern,
        pattern_scale: page.pattern_scale,
        pattern_color: page.pattern_color,
        background_color: page.background_color,
      },
      "Apply page setup to all pages",
    );
  }

  /** Width/height of the little format icon, max 28px. */
  function icon(f: PageFormat) {
    if (!f.size) return null;
    const { width, height } = formatSize(f, f.prefers);
    const k = 28 / Math.max(width, height);
    return { w: width * k, h: height * k };
  }

  let pageName = $state("");
  $effect(() => {
    if (page) pageName = page.name;
  });
</script>

{#if page}
  <Overlay {visible} closeCb={() => overlayManager.close()} title="Page setup" minHeight>
    <div class="flex flex-row gap-2 items-center">
      <div class="flex-1">
        <Input
          id="page-name"
          placeholder="Page {pageIndex + 1}"
          bind:value={pageName}
          onBlur={() => {
            const name = pageName.trim() || `Page ${pageIndex + 1}`;
            if (name !== page.name) set({ name });
          }}
        />
      </div>
      <button
        class="{action} border-content-1/20 text-content-2 hover:bg-overlay/30"
        onclick={() => contentManager.duplicatePage(pageIndex)}
        title="Duplicate page"
        aria-label="Duplicate page"
      >
        <IconCopy />
      </button>
      <button
        class="{action} border-destructive text-destructive hover:bg-destructive hover:text-destructive-content"
        onclick={() => {
          contentManager.deletePage(pageIndex);
          overlayManager.close();
        }}
        title="Delete page (undo with Ctrl+Z)"
        aria-label="Delete page"
      >
        <IconTrash />
      </button>
    </div>

    <section class="flex flex-col gap-2">
      <h2 class="font-semibold text-content-2">Size</h2>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
        {#each PAGE_FORMATS as f (f.id)}
          {@const active = detected?.format.id === f.id}
          {@const ic = icon(f)}
          <button
            class={[chip(active), "flex-col h-24"]}
            onclick={() => chooseFormat(f)}
            aria-pressed={active}
          >
            <div class="h-8 grid place-items-center">
              {#if ic}
                <div class="border-2 border-current rounded-sm" style="width: {ic.w}px; height: {ic.h}px;"></div>
              {:else}
                <IconInfinity />
              {/if}
            </div>
            <span class="font-semibold">{f.label}</span>
            <span class="text-xs opacity-70">{f.hint}</span>
          </button>
        {/each}
      </div>
      {#if !detected}
        <p class="text-sm text-content-3">
          Custom size: {Math.round(page.width)} × {Math.round(page.height)}
        </p>
      {/if}
      {#if detected?.format.size && detected.format.id !== "square"}
        <div class="flex flex-row gap-2">
          {#each [["portrait", "Portrait", IconRectangleVertical], ["landscape", "Landscape", IconRectangle]] as const as [o, label, Icon] (o)}
            <button
              class={[chip(orientation === o), "flex-1 flex-row gap-2 h-12"]}
              onclick={() => chooseOrientation(o)}
              aria-pressed={orientation === o}
            >
              <Icon />
              {label}
            </button>
          {/each}
        </div>
      {/if}
      {#if isInfinite(page)}
        <p class="text-sm text-content-3">
          The page grows in every direction. Use the fit button (bottom left)
          to find your way back to your notes.
        </p>
      {/if}
    </section>

    <section class="flex flex-col gap-2">
      <h2 class="font-semibold text-content-2">Paper</h2>
      <div class="grid grid-cols-4 gap-2">
        {#each PATTERNS as p (p.label)}
          {@const active = page.pattern === p.id}
          <button
            class={[chip(active), "flex-col p-1 gap-1"]}
            onclick={() => set({ pattern: p.id })}
            aria-pressed={active}
          >
            <div
              class="w-full aspect-[4/3] rounded-lg overflow-hidden relative"
              style="background-color: {page.background_color};"
            >
              {#if p.id}
                <div class="absolute inset-0">
                  <BackgroundPatterns uuid pattern={p.id} color={page.pattern_color} scale={12} />
                </div>
              {/if}
            </div>
            <span class="text-sm">{p.label}</span>
          </button>
        {/each}
      </div>

      <div class="flex flex-row flex-wrap gap-2 items-center">
        {#each PAPER_COLORS as c (c.label)}
          {@const active = page.background_color.toLowerCase() === c.bg}
          <button
            class={[chip(active), "flex-row gap-2 h-11 px-3"]}
            onclick={() => set({ background_color: c.bg, pattern_color: c.line })}
            aria-pressed={active}
          >
            <span class="w-5 h-5 rounded-full border border-content-1/30" style="background-color: {c.bg};"></span>
            {c.label}
          </button>
        {/each}
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ColorInput
          id="bg-color"
          description="Paper colour"
          value={page.background_color}
          onChange={(v) => set({ background_color: v })}
        />
        <ColorInput
          id="pattern-color"
          description="Line colour"
          value={page.pattern_color}
          onChange={(v) => set({ pattern_color: v })}
        />
      </div>

      {#if page.pattern}
        <label class="flex flex-col gap-1" for="pattern-scale">
          <span class="flex flex-row justify-between text-sm text-content-2">
            <span>Line spacing</span>
            <span class="tabular-nums">{page.pattern_scale}</span>
          </span>
          <input
            id="pattern-scale"
            type="range"
            class="h-8 accent-[var(--primary)]"
            min="12"
            max="64"
            step="2"
            value={page.pattern_scale}
            onchange={(e) => set({ pattern_scale: +e.currentTarget.value })}
          />
        </label>
      {/if}
    </section>

    {#if contentManager.pages.length > 1}
      <button
        class="flex flex-row items-center justify-center gap-2 h-12 rounded-xl border-2 border-warning text-warning hover:bg-warning hover:text-warning-content transition-all active:scale-95"
        onclick={applyToAll}
      >
        <IconStack2 />
        Apply size and paper to all {contentManager.pages.length} pages
      </button>
    {/if}
  </Overlay>
{/if}

