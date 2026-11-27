<script lang="ts">
  import { untrack } from "svelte";
  import { IconCheck, IconFileImport, IconLoader2, IconRuler2 } from "@tabler/icons-svelte";
  import Overlay from "#lib/components/Overlay.svelte";
  import { contentManager } from "#lib/state/contentManager.svelte.ts";
  import { importPdfPages, type PdfDestination } from "./pdf.svelte";
  import { formatPageRanges, parsePageRanges } from "./pageRanges";
  import { pdfImport } from "./pdfImport.svelte";
  import { detectScan, isOversized, sizeFactor, type PdfSizing } from "./pdfScale";
  import { pageRect, PAGE_FORMATS } from "../pageFormats";

  /*
   * Choose which PDF pages to import and where they go:
   * - as new pages (the PDF page is the background you write on), after the
   *   current page or at the end; or
   * - as images on the current page, e.g. one diagram into your notes.
   * Pages are picked by tapping thumbnails or by typing ranges ("1-3, 7").
   *
   * Scans often claim a page size several times too large (see
   * pdfScale.ts). When a chosen page is oversized, a size picker appears:
   * real paper size (scans), the note's page width, as stored, or a
   * percentage.
   */
  const src = $derived(pdfImport.source);

  let thumbs = $state<(string | undefined)[]>([]);
  let selected = $state<Set<number>>(new Set());
  let rangeText = $state("");
  let rangeError = $state(false);
  let mode = $state<PdfDestination["kind"]>("pages");
  let at = $state<"after" | "end">("after");
  let progress = $state<{ done: number; total: number }>();
  /** Each page's stored size in points, once read. */
  let sizes = $state<{ width: number; height: number }[]>([]);
  let sizeMode = $state<PdfSizing["kind"]>("keep");
  let percent = $state(100);

  const count = $derived(selected.size);
  const order = $derived([...selected].sort((a, b) => a - b));

  // A new document: select everything and render previews one by one, so
  // the first ones appear quickly even for long lecture decks.
  //
  // Only `src` may be a dependency here. The setup is untracked: it reads the
  // state it writes, and a tracked read would re-run this effect forever
  // (Svelte aborts that with effect_update_depth_exceeded).
  $effect(() => {
    const s = src;
    if (!s) return;
    untrack(() => {
      thumbs = Array(s.numPages).fill(undefined);
      setSelection(Array.from({ length: s.numPages }, (_, i) => i + 1));
      mode = "pages";
      progress = undefined;
      sizes = [];
      sizeMode = "keep";
      percent = 100;
    });

    let cancelled = false;
    (async () => {
      const out = [];
      for (let n = 1; n <= s.numPages; n++) {
        try {
          out.push(await s.pageSize(n));
        } catch {
          return; // closed meanwhile
        }
      }
      if (cancelled) return;
      sizes = out;
      // Preselect the fix: real size for scans, else the note's width.
      if (out.some((p) => detectScan(p.width, p.height))) sizeMode = "real";
      else if (out.some((p) => isOversized(p.width, p.height))) sizeMode = "match";
    })();
    (async () => {
      for (let n = 1; n <= s.numPages && !cancelled; n++) {
        try {
          const url = await s.thumbnail(n, 220);
          if (!cancelled) thumbs[n - 1] = url;
        } catch {
          break; // closed meanwhile
        }
      }
    })();
    return () => (cancelled = true);
  });

  function setSelection(pages: number[]) {
    const unique = [...new Set(pages)].sort((a, b) => a - b);
    selected = new Set(unique);
    rangeText = formatPageRanges(unique);
    rangeError = false;
  }

  function toggle(n: number) {
    const next = new Set(selected);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    setSelection([...next]);
  }

  function applyRange() {
    if (!src) return;
    const pages = parsePageRanges(rangeText, src.numPages);
    rangeError = pages === null && rangeText.trim() !== "";
    if (pages) setSelection(pages);
    else if (!rangeText.trim()) setSelection([]);
  }

  async function run() {
    if (!src || count === 0 || progress) return;
    const dest: PdfDestination = mode === "pages" ? { kind: "pages", at } : { kind: "here" };
    progress = { done: 0, total: count };
    try {
      const ok = await importPdfPages(
        src,
        order,
        dest,
        (done, total) => (progress = { done, total }),
        oversized ? sizing : { kind: "keep" },
      );
      if (ok) await pdfImport.close();
    } finally {
      progress = undefined;
    }
  }

  // Sizing applies to the chosen pages; it is offered only when one is oversized.
  const chosen = $derived(order.map((n) => sizes[n - 1]).filter((p) => p !== undefined));
  const oversized = $derived(chosen.find((p) => isOversized(p.width, p.height)));
  const scan = $derived(chosen.map((p) => detectScan(p.width, p.height)).find((s) => s));
  const sheet = $derived(pageRect(contentManager.page));
  const a4 = PAGE_FORMATS.find((f) => f.id === "a4")!.size!;
  const sizing = $derived<PdfSizing>(
    sizeMode === "match"
      ? { kind: "match", width: sheet?.width ?? a4.width }
      : sizeMode === "custom"
        ? { kind: "custom", percent }
        : { kind: sizeMode },
  );
  /** What the first oversized page becomes, in mm. */
  const resultMm = $derived.by(() => {
    if (!oversized) return;
    const k = sizeFactor(sizing, oversized.width, oversized.height) * (25.4 / 72);
    return `${Math.round(oversized.width * k)} × ${Math.round(oversized.height * k)} mm`;
  });

  const seg = (on: boolean) =>
    `h-10 px-4 rounded-lg font-semibold transition-all active:scale-95 ${
      on ? "bg-base-3 text-content-1 shadow-inner" : "text-content-3 hover:text-content-1"
    }`;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
</script>

<Overlay visible={!!src} closeCb={() => pdfImport.close()} title="Import PDF">
  {#if src}
    <p class="-mt-2 text-content-3 truncate">
      {src.name} · {plural(src.numPages, "page")}
    </p>

    <div class="flex flex-row flex-wrap items-center gap-2">
      <button
        class="h-10 px-3 rounded-lg border-2 border-content-1/15 text-content-2 hover:bg-overlay/30 active:scale-95 transition-all"
        onclick={() => setSelection(Array.from({ length: src.numPages }, (_, i) => i + 1))}
      >
        All
      </button>
      <button
        class="h-10 px-3 rounded-lg border-2 border-content-1/15 text-content-2 hover:bg-overlay/30 active:scale-95 transition-all"
        onclick={() => setSelection([])}
      >
        None
      </button>
      <label class="flex-1 min-w-48 flex flex-row items-center gap-2">
        <span class="text-sm text-content-3 shrink-0">Pages</span>
        <input
          bind:value={rangeText}
          onchange={applyRange}
          onkeydown={(e) => e.key === "Enter" && applyRange()}
          placeholder="e.g. 1-3, 7"
          class={[
            "flex-1 h-10 px-3 rounded-lg bg-base-3 focus:outline-none border-2",
            rangeError ? "border-destructive" : "border-transparent focus:border-primary",
          ]}
          aria-invalid={rangeError}
          autocomplete="off"
        />
      </label>
      {#if rangeError}
        <span class="w-full text-sm text-destructive">
          Use page numbers and ranges between 1 and {src.numPages}, like "1-3, 7".
        </span>
      {/if}
    </div>

    {#if oversized}
      <div class="flex flex-col gap-2 p-3 rounded-xl bg-base-2 border border-content-1/10">
        <p class="flex flex-row gap-2 items-center text-sm text-content-2">
          <IconRuler2 size={18} class="shrink-0 text-primary" />
          {#if scan}
            This looks like a scan of {scan.paper} paper at {scan.dpi} dpi, stored {Math.round(1 / scan.factor * 10) / 10}×
            too large: ink and pens would look tiny on it.
          {:else}
            These pages are much larger than paper: ink and pens would look tiny on them.
          {/if}
        </p>
        <div class="flex flex-row flex-wrap items-center gap-2">
          <div class="flex flex-row flex-wrap p-1 rounded-xl bg-base-3" role="radiogroup" aria-label="Page size">
            {#if scan}
              <button role="radio" aria-checked={sizeMode === "real"} class={seg(sizeMode === "real")} onclick={() => (sizeMode = "real")}>
                Real size ({scan.paper})
              </button>
            {/if}
            <button role="radio" aria-checked={sizeMode === "match"} class={seg(sizeMode === "match")} onclick={() => (sizeMode = "match")}>
              {sheet ? "Width of this note's page" : "A4 width"}
            </button>
            <button role="radio" aria-checked={sizeMode === "keep"} class={seg(sizeMode === "keep")} onclick={() => (sizeMode = "keep")}>
              As stored
            </button>
            <button role="radio" aria-checked={sizeMode === "custom"} class={seg(sizeMode === "custom")} onclick={() => (sizeMode = "custom")}>
              Custom
            </button>
          </div>
          {#if sizeMode === "custom"}
            <label class="flex flex-row items-center gap-1">
              <input
                type="number"
                min="1"
                max="400"
                bind:value={percent}
                class="w-20 h-10 px-3 rounded-lg bg-base-3 focus:outline-none border-2 border-transparent focus:border-primary tabular-nums"
                aria-label="Size in percent"
              />
              <span class="text-content-2">%</span>
            </label>
          {/if}
          {#if resultMm}
            <span class="text-sm text-content-3">Pages become {resultMm}</span>
          {/if}
        </div>
      </div>
    {/if}

    <div class="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3 pb-2">
      {#each thumbs as thumb, i (i)}
        {@const n = i + 1}
        {@const on = selected.has(n)}
        <button
          class={[
            "relative flex flex-col gap-1 p-1.5 rounded-xl border-2 transition-all active:scale-95",
            on ? "border-primary bg-primary/10" : "border-transparent bg-base-2 opacity-60 hover:opacity-100",
          ]}
          onclick={() => toggle(n)}
          aria-pressed={on}
          aria-label="Page {n}"
        >
          <!-- The PDF page keeps its own shape (slides are landscape) on a neutral card. -->
          <div class="w-full aspect-square rounded-md bg-base-3 grid place-items-center overflow-hidden p-1">
            {#if thumb}
              <img src={thumb} alt="" class="max-w-full max-h-full object-contain shadow" draggable="false" />
            {:else}
              <IconLoader2 class="animate-spin text-content-3" />
            {/if}
          </div>
          <span class="text-sm tabular-nums text-content-2">{n}</span>
          {#if on}
            <span class="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-primary text-base-1 grid place-items-center shadow">
              <IconCheck size={16} />
            </span>
          {/if}
        </button>
      {/each}
    </div>


    <div class="sticky bottom-0 -mx-4 -mb-4 px-4 py-3 bg-base-1 border-t border-content-1/10 flex flex-row flex-wrap items-center gap-3">
      <div class="flex flex-row p-1 rounded-xl bg-base-2" role="radiogroup" aria-label="Where to put the pages">
        <button role="radio" aria-checked={mode === "pages"} class={seg(mode === "pages")} onclick={() => (mode = "pages")}>
          As new pages
        </button>
        <button role="radio" aria-checked={mode === "here"} class={seg(mode === "here")} onclick={() => (mode = "here")}>
          On this page
        </button>
      </div>
      {#if mode === "pages"}
        <div class="flex flex-row p-1 rounded-xl bg-base-2" role="radiogroup" aria-label="Insert position">
          <button role="radio" aria-checked={at === "after"} class={seg(at === "after")} onclick={() => (at = "after")}>
            After page {contentManager.currentPage + 1}
          </button>
          <button role="radio" aria-checked={at === "end"} class={seg(at === "end")} onclick={() => (at = "end")}>
            At the end
          </button>
        </div>
      {:else}
        <span class="text-sm text-content-3">Placed as images you can move with the lasso</span>
      {/if}
      <button
        class="ml-auto h-11 px-5 flex flex-row gap-2 items-center rounded-xl border-2 border-success text-success hover:bg-success hover:text-success-content font-bold active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
        disabled={count === 0 || !!progress}
        onclick={run}
      >
        {#if progress}
          <IconLoader2 class="animate-spin" /> Importing {progress.done} / {progress.total}…
        {:else}
          <IconFileImport /> Import {plural(count, "page")}
        {/if}
      </button>
    </div>
  {/if}
</Overlay>
