<script lang="ts">
  import { CanvasManager } from "$lib/canvas/CanvasManager.svelte";
  import { PageManager } from "$lib/canvas/PageManager.svelte";
  import type { FileMeta } from "$lib/types/bindings/FileMeta";
  import type { ToolSettings } from "$lib/types/canvas";
  import { invoke } from "@tauri-apps/api/core";

  let {
    tool,
    canvasManager,
    pageManager,
  }: {
    tool: ToolSettings;
    canvasManager: CanvasManager;
    pageManager: PageManager;
  } = $props();

  // let canvasManager = $state(new CanvasManager());
  // let pageManager = $state(new PageManager());

  let container = $state<HTMLDivElement>();
  canvasManager.setPage(pageManager.currentPage, pageManager.currentPageIndex);

  $effect(() => {
    pageManager.currentPage;
    pageManager.currentPageIndex;
    canvasManager.setPage(
      pageManager.currentPage,
      pageManager.currentPageIndex,
    );
  });

  $effect(() => {
    if (container) {
      const resizeObserver = new ResizeObserver(([container]) => {
        const { width, height } = container.contentRect;
        canvasManager.setViewport(width, height);
      });

      resizeObserver.observe(container);

      return () => {
        resizeObserver.disconnect();
      };
    }
  });

  $effect(() => {
    const { type, ...settings } = tool;
    pageManager.changeTool(type as any, settings);
  });

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const zoomFactor = e.deltaY > 0 ? 0.95 : 1.05;
      canvasManager.zoomAt(e.clientX, e.clientY, zoomFactor);
    } else {
      canvasManager.pan(-e.deltaX, -e.deltaY);
    }
  }

  function handlePointerDown(e: PointerEvent) {
    pageManager.unlockInput();
    const { x, y } = canvasManager.getSvgCoordinates(e.clientX, e.clientY)!;
    pageManager.input(x, y, e.pressure ?? 0.5);
  }
  function handlePointerUp() {
    pageManager.lockInput();
    pageManager.finishInput();
  }
  function handlePointerMove(e: PointerEvent) {
    if (e.pressure > 0) {
      const { x, y } = canvasManager.getSvgCoordinates(e.clientX, e.clientY)!;
      pageManager.input(x, y, e.pressure ?? 0.5);
    }
  }
</script>

<div
  bind:this={container}
  onpointerdown={handlePointerDown}
  onpointerup={handlePointerUp}
  onpointermove={handlePointerMove}
  onwheel={handleWheel}
  role="document"
  oncontextmenu={(e) => {
    e.preventDefault();
  }}
  class="cursor-crosshair w-full h-full relative"
>
  <svg
    viewBox={canvasManager.viewBoxString}
    class="absolute top-0 left-0 w-full h-full"
  >
    {#if canvasManager.pageBounds}
      {@const pageBounds = canvasManager.pageBounds}
      <rect
        x={pageBounds.left}
        y={pageBounds.top}
        width={pageBounds.width}
        height={pageBounds.height}
        fill={canvasManager.backgroundColor}
      />
    {/if}
  </svg>
  {#each pageManager.currentPage.allSVGs as layer, i (`layer ${i}`)}
    {@const viewBox = canvasManager.viewBoxString}
    <svg {viewBox} class="absolute top-0 left-0 w-full h-full">
      {#each layer as segment}
        <path fill={segment.color} stroke="none" d={segment.path} />
      {/each}

      {#if i === pageManager.currentPage.layerManager.selectedLayerIndex}
        <g class="preview-layer">
          {#each pageManager.currentPage.layerManager.strokePreview as segment}
            <path d={segment.path} fill={segment.color} stroke="none" />
          {/each}
        </g>
      {/if}
    </svg>
  {/each}
</div>
