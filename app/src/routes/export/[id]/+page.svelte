<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import Switch from "$lib/components/Switch.svelte";
  import PageThumbnail from "$lib/components/PageThumbnail.svelte";
  import AreaImage from "$lib/editor/export/AreaImage.svelte";
  import RegionCanvas from "$lib/editor/export/RegionCanvas.svelte";
  import {
    FORMAT_INFO,
    planJobs,
    runExport,
    type ExportFormat,
    type ExportMode,
  } from "$lib/editor/export/export";
  import {
    coverContent,
    move,
    nextRegion,
    nominalSize,
    REGION_FORMATS,
    regionFormat,
    reshape,
  } from "$lib/editor/export/regions";
  import { blockBounds } from "$lib/editor/blocks";
  import { contentBounds, isInfinite, pageRect } from "$lib/editor/pageFormats";
  import { lassoManager } from "$lib/editor/state/lassoManager.svelte";
  import { contentManager } from "$lib/state/contentManager.svelte";
  import { tabManager } from "$lib/state/tabManager.svelte";
  import type { ContentBounds } from "$lib/util/canvasBounds";
  import {
    IconArrowLeft,
    IconCheck,
    IconChevronLeft,
    IconChevronRight,
    IconChevronsLeft,
    IconChevronsRight,
    IconLayoutGrid,
    IconLoader2,
    IconPlus,
    IconRectangle,
    IconRectangleVertical,
    IconTrash,
  } from "@tabler/icons-svelte";

  /*
   * Export: choose *what* (pages, the lasso selection, or regions drawn on
   * the canvas), *how* (format, resolution, paper) and see it on the right
   * before saving.
   */

  const tab = $derived(tabManager.tab);

  $effect(() => {
    if (!tabManager.tab) goto(resolve("/"));
  });

  // Start in the mode that most likely matches what you came for.
  let mode = $state<ExportMode>(
    lassoManager.selection
      ? "selection"
      : isInfinite(contentManager.page) || (tabManager.tab?.exportRegions.length ?? 0) > 0
        ? "regions"
        : "pages",
  );
  let pages = $state<"all" | "current">("all");
  let format = $state<ExportFormat>("pdf");
  let scale = $state(2);
  let paper = $state(true);
  let busy = $state(false);

  let previewPage = $state(contentManager.currentPage);
  let selected = $state<string | undefined>(tabManager.tab?.exportRegions[0]?.id);

  const jobs = $derived(planJobs({ mode, pages }));
  const regions = $derived(tab?.exportRegions ?? []);
  const region = $derived(regions.find((r) => r.id === selected));
  const regionIndex = $derived(regions.findIndex((r) => r.id === selected));

  // Follow the selected region to its page.
  $effect(() => {
    if (region) previewPage = region.pageIndex;
  });

  const MODES: { id: ExportMode; label: string }[] = [
    { id: "pages", label: "Pages" },
    { id: "selection", label: "Selection" },
    { id: "regions", label: "Regions" },
  ];

  function anchor(): ContentBounds | null {
    const page = contentManager.pages[previewPage];
    return page ? (pageRect(page) ?? contentBounds(page.layers)) : null;
  }

  function addRegion() {
    if (!tab) return;
    const r = nextRegion(tab.exportRegions, previewPage, anchor());
    tab.exportRegions = [...tab.exportRegions, r];
    selected = r.id;
  }

  function cover() {
    if (!tab) return;
    const page = contentManager.pages[previewPage];
    const content = page && contentBounds(page.layers);
    if (!content) return;
    const blocks = page.layers
      .filter((l) => l.visible)
      .flatMap((l) => l.blocks)
      .map(blockBounds)
      .filter((b): b is ContentBounds => b !== null);
    const fmt = region ?? { formatId: "a4", orientation: "portrait" as const };
    const tiles = coverContent(
      content,
      blocks,
      previewPage,
      fmt.formatId,
      fmt.orientation,
      tab.exportRegions.length + 1,
    );
    tab.exportRegions = [...tab.exportRegions, ...tiles];
    selected = tiles[0]?.id ?? selected;
  }

  function patchRegion(fn: (r: NonNullable<typeof region>) => NonNullable<typeof region>) {
    if (!tab || !region) return;
    tab.exportRegions = tab.exportRegions.map((r) => (r.id === region.id ? fn(r) : r));
  }

  function reorder(to: number) {
    if (!tab || regionIndex === -1) return;
    tab.exportRegions = move(tab.exportRegions, regionIndex, to);
  }

  function removeRegion(id: string) {
    if (!tab) return;
    const i = tab.exportRegions.findIndex((r) => r.id === id);
    tab.exportRegions = tab.exportRegions.filter((r) => r.id !== id);
    if (selected === id) selected = tab.exportRegions[Math.min(i, tab.exportRegions.length - 1)]?.id;
  }

  async function doExport() {
    busy = true;
    try {
      await runExport({ mode, pages, format, scale, paper });
    } finally {
      busy = false;
    }
  }

  const count = $derived(jobs.length);
  const what = $derived(
    mode === "pages" ? "page" : mode === "regions" ? "region" : "selection",
  );
  const summary = $derived(
    count === 0
      ? "Nothing to export"
      : `Export ${count} ${what}${count === 1 || what === "selection" ? "" : "s"} as ${FORMAT_INFO[format].label}`,
  );

  // Shared class strings (Tailwind: the active variant replaces, never stacks).
  const card = "flex flex-col gap-3 p-4 rounded-2xl bg-base-2";
  const seg = (on: boolean) =>
    `flex-1 h-11 px-3 rounded-xl font-semibold transition-all active:scale-95 ${
      on ? "bg-base-3 text-content-1 shadow-inner" : "text-content-3 hover:text-content-1"
    }`;
  const btnBase =
    "h-11 rounded-xl border-2 hover:bg-overlay/30 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none";
  const idle = "border-content-1/10 text-content-2 hover:text-content-1";
  const iconBtn = `${btnBase} ${idle} w-11 grid place-items-center`;
  const iconToggle = (on: boolean) =>
    `${btnBase} w-11 grid place-items-center ${on ? "border-info text-info" : idle}`;
  const wideBtn = `${btnBase} ${idle} flex flex-row gap-2 items-center justify-center px-3 font-semibold`;
</script>

{#if tab}
  <div class="h-full flex flex-col md:flex-row gap-4 p-4 bg-base-1 overflow-hidden">
    <!-- Controls -->
    <aside class="md:w-[26rem] shrink-0 flex flex-col gap-4 min-h-0 overflow-y-auto">
      <div class="flex flex-row items-center gap-2">
        <button
          class={iconBtn}
          onclick={() => goto(resolve("/edit/[id]", { id: contentManager.id }))}
          aria-label="Back to the note"
          title="Back to the note"
        >
          <IconArrowLeft />
        </button>
        <div class="min-w-0">
          <h1 class="font-display text-2xl font-medium leading-tight">Export</h1>
          <p class="text-sm text-content-3 truncate">{contentManager.title}</p>
        </div>
      </div>

      <div class="flex flex-row p-1 rounded-2xl bg-base-2" role="tablist" aria-label="What to export">
        {#each MODES as m (m.id)}
          <button role="tab" aria-selected={mode === m.id} class={seg(mode === m.id)} onclick={() => (mode = m.id)}>
            {m.label}
          </button>
        {/each}
      </div>

      {#if mode === "pages"}
        <section class={card}>
          {#if contentManager.pages.length > 1}
            <div class="flex flex-row p-1 rounded-xl bg-base-1">
              <button class={seg(pages === "all")} onclick={() => (pages = "all")}>
                All {contentManager.pages.length} pages
              </button>
              <button class={seg(pages === "current")} onclick={() => (pages = "current")}>
                Page {contentManager.currentPage + 1} only
              </button>
            </div>
          {/if}
          <p class="text-sm text-content-3">
            Each page keeps its own size. Infinite pages are cropped to their
            content; for fixed sizes, use Regions.
          </p>
        </section>
      {:else if mode === "selection"}
        <section class={card}>
          {#if lassoManager.selection}
            <p>
              <span class="font-semibold">{lassoManager.selectedIds.size}</span>
              selected item{lassoManager.selectedIds.size === 1 ? "" : "s"} on page
              {contentManager.currentPage + 1}, cropped to fit.
            </p>
          {:else}
            <p class="text-content-2">
              Nothing is selected. Go back, circle something with the lasso,
              and come back here.
            </p>
          {/if}
        </section>
      {:else}
        <section class={card}>
          <div class="flex flex-row items-center justify-between">
            <h2 class="font-semibold text-content-2">Regions</h2>
            <span class="text-sm text-content-3">Each region becomes one page</span>
          </div>

          {#if regions.length > 0}
            <ol class="flex flex-col gap-2">
              {#each regions as r, i (r.id)}
                {@const active = r.id === selected}
                <li
                  class={[
                    "flex flex-row items-center rounded-xl border-2 transition-all",
                    active ? "border-info bg-info/10" : "border-content-1/10 bg-base-1",
                  ]}
                >
                  <button class="flex-1 min-w-0 flex flex-row items-center gap-3 p-3 text-left" onclick={() => (selected = r.id)}>
                    <span class="w-6 text-content-3 tabular-nums">{i + 1}</span>
                    <span class="flex-1 truncate font-semibold">{r.name}</span>
                    <span class="text-sm text-content-3">
                      {regionFormat(r).label}{contentManager.pages.length > 1 ? ` · p. ${r.pageIndex + 1}` : ""}
                    </span>
                  </button>
                  <button
                    class="w-11 h-11 grid place-items-center text-content-3 hover:text-destructive transition-all"
                    onclick={() => removeRegion(r.id)}
                    aria-label="Remove {r.name}"
                  >
                    <IconTrash size={18} />
                  </button>
                </li>
              {/each}
            </ol>
          {:else}
            <p class="text-sm text-content-3">
              Add a region and drag it over the part you want, or let Cover
              content lay out pages over everything you wrote.
            </p>
          {/if}

          <div class="grid grid-cols-2 gap-2">
            <button class={wideBtn} onclick={addRegion}>
              <IconPlus size={20} /> Add region
            </button>
            <button class={wideBtn} onclick={cover}>
              <IconLayoutGrid size={20} /> Cover content
            </button>
          </div>
        </section>

        {#if region}
          <section class={card}>
            <input
              class="h-11 px-3 rounded-xl bg-base-3 font-semibold focus:outline-none focus:ring-2 focus:ring-info"
              value={region.name}
              aria-label="Region name"
              onchange={(e) => {
                const name = e.currentTarget.value.trim();
                if (name) patchRegion((r) => ({ ...r, name }));
              }}
            />
            <div class="flex flex-row gap-2">
              <select
                class="flex-1 min-w-0 h-11 pl-3 pr-9 rounded-xl appearance-none bg-base-3 text-content-1 border-2 border-content-1/10 focus:outline-none focus:border-info bg-no-repeat bg-[length:1.1rem] bg-[right_0.6rem_center]"
                style="background-image: url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a6adc8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E&quot;);"
                aria-label="Region format"
                value={region.formatId}
                onchange={(e) => {
                  const id = e.currentTarget.value;
                  const f = REGION_FORMATS.find((f) => f.id === id);
                  patchRegion((r) => reshape(r, id, f?.prefers ?? r.orientation));
                }}
              >
                {#each REGION_FORMATS as f (f.id)}
                  <option class="bg-base-2 text-content-1" value={f.id}>{f.label} — {f.hint}</option>
                {/each}
              </select>
              {#each [["portrait", IconRectangleVertical], ["landscape", IconRectangle]] as const as [o, Icon] (o)}
                <button
                  class={iconToggle(region.orientation === o)}
                  disabled={region.formatId === "square"}
                  onclick={() => patchRegion((r) => reshape(r, r.formatId, o))}
                  aria-label={o}
                  aria-pressed={region.orientation === o}
                  title={o === "portrait" ? "Portrait" : "Landscape"}
                >
                  <Icon />
                </button>
              {/each}
            </div>
            <div class="flex flex-row items-center gap-2">
              <span class="flex-1 text-sm text-content-3">
                Content at {Math.round((nominalSize(region).width / region.width) * 100)}% of its size on the canvas
              </span>
              <button
                class="h-9 px-3 rounded-lg text-sm text-content-2 hover:bg-overlay/30 transition-all"
                onclick={() =>
                  patchRegion((r) => {
                    const n = nominalSize(r);
                    return { ...r, width: n.width, height: n.height };
                  })}
              >
                Reset to 100%
              </button>
            </div>
            <div class="flex flex-row items-center gap-2">
              <span class="flex-1 font-semibold text-content-2">Order</span>
              <button class={iconBtn} disabled={regionIndex <= 0} onclick={() => reorder(0)} aria-label="Move to first" title="First">
                <IconChevronsLeft />
              </button>
              <button class={iconBtn} disabled={regionIndex <= 0} onclick={() => reorder(regionIndex - 1)} aria-label="Move earlier" title="Earlier">
                <IconChevronLeft />
              </button>
              <button class={iconBtn} disabled={regionIndex >= regions.length - 1} onclick={() => reorder(regionIndex + 1)} aria-label="Move later" title="Later">
                <IconChevronRight />
              </button>
              <button class={iconBtn} disabled={regionIndex >= regions.length - 1} onclick={() => reorder(regions.length - 1)} aria-label="Move to last" title="Last">
                <IconChevronsRight />
              </button>
            </div>
          </section>
        {/if}
      {/if}

      <section class={card}>
        <Switch
          id="export-paper"
          label="Include paper"
          description="Paper colour, lines and imported PDF pages. Off gives a transparent PNG/SVG (white for JPG and PDF)."
          checked={paper}
          onChange={(v) => {
            paper = v;
          }}
        />
        {#if format !== "svg"}
          <div class="flex flex-row items-center gap-3">
            <span class="flex-1 font-semibold text-content-2">Resolution</span>
            <div class="flex flex-row p-1 rounded-xl bg-base-1">
              {#each [1, 2, 3] as s (s)}
                <button class="{seg(scale === s)} w-14 flex-none" onclick={() => (scale = s)}>{s}×</button>
              {/each}
            </div>
          </div>
        {/if}
      </section>

      <div class="mt-auto flex flex-col gap-3 sticky bottom-0 bg-base-1 pt-2">
        <div class="flex flex-row p-1 rounded-2xl bg-base-2" role="radiogroup" aria-label="File format">
          {#each Object.entries(FORMAT_INFO) as [id, f] (id)}
            <button
              role="radio"
              aria-checked={format === id}
              class={seg(format === id)}
              onclick={() => (format = id as ExportFormat)}
            >
              {f.label}
            </button>
          {/each}
        </div>
        <button
          class="h-14 rounded-2xl border-2 border-success text-success hover:bg-success hover:text-success-content font-bold tracking-wide flex flex-row gap-2 items-center justify-center transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          disabled={count === 0 || busy}
          onclick={doExport}
        >
          {#if busy}
            <IconLoader2 class="animate-spin" /> Exporting…
          {:else}
            <IconCheck /> {summary}
          {/if}
        </button>
      </div>
    </aside>

    <!-- Preview -->
    <main class="flex-1 min-h-0 min-w-0 rounded-2xl bg-base-3 relative overflow-hidden">
      {#if mode === "regions"}
        <div class="absolute inset-0 p-10 pt-14">
          <RegionCanvas pageIndex={previewPage} bind:selected />
        </div>
        {#if contentManager.pages.length > 1}
          <div class="absolute top-3 left-1/2 -translate-x-1/2 flex flex-row items-center gap-1 p-1 rounded-xl bg-base-1 shadow">
            <button class="w-9 h-9 grid place-items-center rounded-lg hover:bg-overlay/30 disabled:opacity-30" disabled={previewPage === 0} onclick={() => (previewPage -= 1)} aria-label="Previous page">
              <IconChevronLeft size={18} />
            </button>
            <span class="text-sm font-semibold tabular-nums px-2">Page {previewPage + 1} / {contentManager.pages.length}</span>
            <button class="w-9 h-9 grid place-items-center rounded-lg hover:bg-overlay/30 disabled:opacity-30" disabled={previewPage >= contentManager.pages.length - 1} onclick={() => (previewPage += 1)} aria-label="Next page">
              <IconChevronRight size={18} />
            </button>
          </div>
        {/if}
      {:else if mode === "selection"}
        {@const job = jobs[0]}
        {#if job}
          <div class="absolute inset-0 p-10 grid place-items-center">
            <div
              class="max-w-full max-h-full shadow-lg"
              style="aspect-ratio: {job.area.width} / {job.area.height}; width: min(100%, {job.area.width * 2}px);"
            >
              <AreaImage page={job.page} area={job.area} only={job.only} {paper} pixelWidth={Math.min(1600, job.area.width * 2)} />
            </div>
          </div>
        {/if}
      {:else}
        <div class="absolute inset-0 overflow-y-auto p-6">
          <div class="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-4">
            {#each jobs as job, i (i)}
              <figure class="flex flex-col gap-2">
                <div class="shadow-lg"><PageThumbnail page={job.page} /></div>
                <figcaption class="text-sm text-content-3 truncate">{i + 1} · {job.name}</figcaption>
              </figure>
            {/each}
          </div>
        </div>
      {/if}
    </main>
  </div>
{/if}
