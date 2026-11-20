<script lang="ts">
  import { inputToPath } from "#lib/editor/svg.ts";
  import { useShortcuts } from "#lib/editor/shortcuts.svelte.ts";
  import ToolCursor from "#lib/editor/ToolCursor.svelte";
  import { contentManager } from "#lib/state/contentManager.svelte.ts";
  import { lassoManager } from "#lib/editor/state/lassoManager.svelte.ts";
  import { tick, untrack } from "svelte";
  import LassoSelection from "#lib/editor/LassoSelection.svelte";
  import { canvasManager } from "#lib/editor/state/canvasManager.svelte.ts";
  import { canvasController } from "#lib/editor/canvasController.svelte.ts";
  import LassoMenu from "#lib/editor/LassoMenu.svelte";
  import Toolbar from "#lib/editor/Toolbar.svelte";
  import ViewControls from "#lib/editor/ViewControls.svelte";
  import Paper from "#lib/editor/Paper.svelte";
  import TextEditorOverlay from "#lib/editor/TextEditorOverlay.svelte";
  import { pageRect } from "#lib/editor/pageFormats.ts";
  import { tabManager } from "#lib/state/tabManager.svelte.ts";
  import { insertImageFile } from "#lib/editor/import/image.ts";
  import { goto } from "$app/navigation";
  import { laserManager } from "#lib/editor/state/laserManager.svelte.ts";
  import PresenterBar from "#lib/present/PresenterBar.svelte";
  import { usePresenterSync } from "#lib/present/sync.svelte.ts";
  import { resolve } from "$app/paths";

  let cursorX = $state(0);
  let cursorY = $state(0);
  let cursorVisible = $state(false);

  const view = $derived(canvasManager.viewBounds());
  const clip = $derived(pageRect(contentManager.page));

  const preview = $derived(
    inputToPath(
      canvasManager.points,
      canvasManager.thickness,
      canvasManager.drawing,
    ),
  );

  // Without an open tab there is nothing to edit (e.g. after a reload).
  $effect(() => {
    if (!tabManager.tab) goto(resolve("/"));
  });

  // One effect for all canvas repaints: it tracks what is drawn and asks the
  // frame loop for a repaint whenever any of it changes.
  $effect(() => {
    canvasManager.watch();
  });

  // Fit the page into view when switching pages, and when opening a note
  // whose view was never moved (a new note).
  let shown: { note: string; page: number } | undefined;
  $effect(() => {
    const note = contentManager.id;
    const page = contentManager.currentPage;
    void canvasManager.width;

    untrack(() => {
      if (canvasManager.width === 0) return;
      const pristine =
        contentManager.zoom === 1 &&
        contentManager.panX === 0 &&
        contentManager.panY === 0;
      const changedPage = shown?.note === note && shown.page !== page;

      if (shown?.note !== note || changedPage) {
        if (changedPage || pristine) tick().then(() => canvasManager.fitPage());
        else canvasManager.clampPan();
      }
      shown = { note, page };
    });
  });

  // Paste images from the clipboard.
  $effect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!tabManager.tab) return;
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea")) return;
      const file = [...(e.clipboardData?.files ?? [])].find((f) =>
        f.type.startsWith("image/"),
      );
      if (!file) return;
      e.preventDefault();
      insertImageFile(file);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  });

  useShortcuts();
  usePresenterSync();
</script>

<div
  class={[
    "w-full h-full relative touch-none overflow-hidden bg-base-3",
    {
      "hide-cursor": !(canvasManager.tool === "lasso" && !lassoManager.isSelecting),
      "cursor-text": canvasManager.tool === "text",
    },
  ]}
  bind:clientWidth={canvasManager.width}
  bind:clientHeight={canvasManager.height}
  use:canvasController={{
    updateCursor: (visible, x, y) => {
      cursorVisible = visible;
      if (x !== undefined) cursorX = x;
      if (y !== undefined) cursorY = y;
    },
  }}
  role="document"
>
  <Paper />
  <div
    class={[
      "absolute w-full h-full top-0 transition-[filter]",
      {
        "contrast-20":
          canvasManager.tool === "lasso" && !!lassoManager.selection,
      },
    ]}
  >
    {#each contentManager.layers as layer (`layer-${layer.id}`)}
      <canvas
        class="absolute top-0"
        style="width: {canvasManager.width}px; height: {canvasManager.height}px;"
        width={Math.round(canvasManager.width * canvasManager.dpr)}
        height={Math.round(canvasManager.height * canvasManager.dpr)}
        use:canvasManager.assignContext={layer.id}
      ></canvas>
    {/each}
  </div>

  <svg
    class="w-full h-full absolute top-0 pointer-events-none"
    viewBox="{view.min.x} {view.min.y} {view.width} {view.height}"
    preserveAspectRatio="none"
  >
    {#if clip}
      <clipPath id="page-clip">
        <rect x={clip.min.x} y={clip.min.y} width={clip.width} height={clip.height} />
      </clipPath>
    {/if}
    <path
      d={preview}
      fill={canvasManager.color}
      fill-opacity={canvasManager.opacity}
      clip-path={clip ? "url(#page-clip)" : undefined}
    />
    <LassoSelection />
    {#each laserManager.strokes as s (s.id)}
      <path
        d={inputToPath(s.points, 6 / contentManager.zoom, false)}
        class="fill-destructive"
        style="opacity: {s.opacity}; filter: drop-shadow(0 0 4px var(--destructive));"
      />
    {/each}
  </svg>
  <TextEditorOverlay />
  <ToolCursor visible={cursorVisible} x={cursorX} y={cursorY} />
  <LassoMenu />
</div>

<Toolbar />
<PresenterBar />
<ViewControls />
