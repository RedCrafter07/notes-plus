<script lang="ts">
  import { inputToPath } from "$lib/editor/svg";
  import { useShortcuts } from "$lib/editor/shortcuts.svelte";
  import ToolCursor from "$lib/editor/ToolCursor.svelte";
  import { contentManager } from "$lib/state/contentManager.svelte";
  import { lassoManager } from "$lib/editor/state/lassoManager.svelte";
  import { tick } from "svelte";
  import LassoSelection from "$lib/editor/LassoSelection.svelte";
  import { canvasManager } from "$lib/editor/state/canvasManager.svelte";
  import { canvasController } from "$lib/editor/canvasController.svelte";
  import LassoMenu from "$lib/editor/LassoMenu.svelte";
  import Toolbar from "$lib/editor/Toolbar.svelte";
  import ZoomIndicator from "$lib/editor/ZoomIndicator.svelte";

  let cursorX = $state(0);
  let cursorY = $state(0);
  let cursorVisible = $state(false);

  let preview = $state<string>();

  let svgViewBox = $derived(
    `${canvasManager.translateToRelative(0, 0).x} ${canvasManager.translateToRelative(0, 0).y} ${canvasManager.width / contentManager.zoom} ${canvasManager.height / contentManager.zoom}`,
  );

  $effect(() => {
    canvasManager.redrawStrokes();
  });

  $effect(() => {
    preview = inputToPath(
      canvasManager.points,
      canvasManager.thickness,
      canvasManager.drawing,
    );
  });

  $effect(() => {
    canvasManager.width;
    canvasManager.height;
    contentManager.id;

    (async () => {
      await tick();
      canvasManager.redrawStrokes();
    })();
  });

  useShortcuts();
</script>

<div
  class="bg-white w-full h-full relative touch-none hide-cursor overflow-hidden"
  bind:clientWidth={canvasManager.width}
  bind:clientHeight={canvasManager.height}
  class:hide-cursor={!(
    !lassoManager.isSelecting && canvasManager.tool === "lasso"
  )}
  use:canvasController={{
    updateCursor: (visible, x, y) => {
      cursorVisible = visible;
      if (x) cursorX = x;
      if (y) cursorY = y;
    },
  }}
  role="document"
>
  <div
    class={[
      "absolute w-full h-full top-0 transition-all",
      {
        "contrast-20":
          canvasManager.tool === "lasso" && !lassoManager.isSelecting,
      },
    ]}
  >
    {#each contentManager.layers as layer (`layer-${layer.id}`)}
      <canvas
        class="absolute w-full h-full top-0"
        style="width: {canvasManager.width}px; height: {canvasManager.height}px;"
        width={canvasManager.width * canvasManager.dpr}
        height={canvasManager.height * canvasManager.dpr}
        class:opacity-0={!layer.visible}
        use:canvasManager.assignContext={layer.id}
      ></canvas>
    {/each}
  </div>

  <svg class="w-full h-full absolute top-0" viewBox={svgViewBox}>
    <path d={preview} fill={canvasManager.color} />
    <LassoSelection />
  </svg>
  <ToolCursor visible={cursorVisible} x={cursorX} y={cursorY} />
  <LassoMenu />
</div>

<Toolbar />
<ZoomIndicator />
