<script lang="ts">
  import { contentManager } from "#lib/state/contentManager.svelte.ts";
  import { padBounds, unionBounds, type ContentBounds } from "#lib/util/canvasBounds.ts";
  import { pageArea } from "../render/page";
  import AreaImage from "./AreaImage.svelte";
  import { formatLabel, isFree, regionBounds, type ExportRegion } from "./regions";

  /*
   * The page with its export regions on top. Drag a region to move it, drag
   * its corner to resize it (a fixed format keeps its ratio, "free" does
   * not). The view fits the page plus all regions and is frozen while
   * dragging so nothing jumps. A drag edits a local draft and is committed
   * on release, so it is one undo step.
   */
  let {
    pageIndex,
    selected = $bindable(),
  }: { pageIndex: number; selected?: string } = $props();

  let boxW = $state(0);
  let boxH = $state(0);
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;

  const page = $derived(contentManager.pages[pageIndex]);
  let draft = $state<ExportRegion[]>();
  const regions = $derived(draft ?? page?.regions ?? []);

  function fitExtent(): ContentBounds {
    let ext = page ? pageArea(page) : null;
    for (const r of regions) ext = ext ? unionBounds(ext, regionBounds(r)) : regionBounds(r);
    ext ??= { min: { x: 0, y: 0 }, max: { x: 794, y: 1123 }, width: 794, height: 1123 };
    return padBounds(ext, Math.max(ext.width, ext.height) * 0.04);
  }

  let frozen = $state<ContentBounds>();
  const extent = $derived(frozen ?? fitExtent());
  const k = $derived(boxW && boxH ? Math.min(boxW / extent.width, boxH / extent.height) : 0);
  const ox = $derived((boxW - extent.width * k) / 2);
  const oy = $derived((boxH - extent.height * k) / 2);

  const toScreen = (x: number, y: number) => ({
    left: ox + (x - extent.min.x) * k,
    top: oy + (y - extent.min.y) * k,
  });

  function update(id: string, patch: Partial<ExportRegion>) {
    draft = regions.map((r) => (r.id === id ? { ...r, ...patch } : r));
  }

  let drag:
    | { id: string; kind: "move" | "resize"; sx: number; sy: number; start: ExportRegion }
    | undefined;

  function start(e: PointerEvent, r: ExportRegion, kind: "move" | "resize") {
    e.stopPropagation();
    selected = r.id;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    frozen = extent;
    drag = { id: r.id, kind, sx: e.clientX, sy: e.clientY, start: r };
  }

  function moveDrag(e: PointerEvent) {
    if (!drag || !k) return;
    const dx = (e.clientX - drag.sx) / k;
    const dy = (e.clientY - drag.sy) / k;
    const s = drag.start;
    if (drag.kind === "move") update(drag.id, { x: s.x + dx, y: s.y + dy });
    else if (isFree(s))
      update(drag.id, { width: Math.max(40, s.width + dx), height: Math.max(40, s.height + dy) });
    else {
      const width = Math.max(80, s.width + dx);
      update(drag.id, { width, height: (width * s.height) / s.width });
    }
  }

  function endDrag() {
    if (draft) contentManager.setRegions(pageIndex, draft, drag?.kind === "resize" ? "Resize region" : "Move region");
    draft = undefined;
    drag = undefined;
    frozen = undefined;
  }
</script>

<div
  class="relative w-full h-full overflow-hidden touch-none"
  bind:clientWidth={boxW}
  bind:clientHeight={boxH}
>
  {#if page && k > 0}
    {@const tl = toScreen(extent.min.x, extent.min.y)}
    <div
      class="absolute"
      style="left: {tl.left}px; top: {tl.top}px; width: {extent.width * k}px; height: {extent.height * k}px;"
    >
      <AreaImage {page} area={extent} pixelWidth={extent.width * k * dpr} />
    </div>

    {#each regions as r, i (r.id)}
      {@const p = toScreen(r.x, r.y)}
      {@const active = r.id === selected}
      <div
        role="button"
        tabindex="0"
        aria-label="{r.name}, {formatLabel(r)}"
        aria-pressed={active}
        class={[
          "absolute border-[3px] cursor-move transition-colors",
          active ? "border-info bg-info/10 z-10" : "border-dashed border-success/90 bg-success/5",
        ]}
        style="left: {p.left}px; top: {p.top}px; width: {r.width * k}px; height: {r.height * k}px;"
        onpointerdown={(e) => start(e, r, "move")}
        onpointermove={moveDrag}
        onpointerup={endDrag}
        onpointercancel={endDrag}
        onkeydown={(e) => {
          if (e.key === "Enter" || e.key === " ") selected = r.id;
        }}
      >
        <span
          class={[
            "absolute -top-3 left-1/2 -translate-x-1/2 -translate-y-full px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap",
            active ? "bg-info text-info-content" : "bg-success text-success-content",
          ]}
        >
          {i + 1} · {r.name}
        </span>
        <!-- Resize: a finger-sized corner handle -->
        <span
          role="presentation"
          class={[
            "absolute -right-3 -bottom-3 w-7 h-7 rounded-full border-[3px] border-base-1 cursor-nwse-resize",
            active ? "bg-info" : "bg-success",
          ]}
          onpointerdown={(e) => start(e, r, "resize")}
          onpointermove={moveDrag}
          onpointerup={endDrag}
          onpointercancel={endDrag}
        ></span>
      </div>
    {/each}
  {/if}
</div>
