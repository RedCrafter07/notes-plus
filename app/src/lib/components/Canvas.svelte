<script lang="ts">
  import { BlockManager } from "$lib/canvas/BlockManager.svelte";
  import type { ToolSettings } from "$lib/types/canvas";

  const { tool }: { tool: ToolSettings } = $props();

  let blockManager = $state(new BlockManager());

  $effect(() => {
    const { type, ...settings } = tool;
    blockManager.changeTool(type as any, settings);
  });

  function handlePointerDown(e: PointerEvent) {
    blockManager.inputLocked = false;
    blockManager.input(e.clientX, e.clientY, e.pressure ?? 0.5);
  }
  function handlePointerUp() {
    blockManager.inputLocked = true;
    blockManager.finishInput();
  }
  function handlePointerMove(e: PointerEvent) {
    if (e.pressure > 0)
      blockManager.input(e.clientX, e.clientY, e.pressure ?? 0.5);
  }
</script>

<svg
  role="document"
  width="100%"
  height="100%"
  onpointerdown={handlePointerDown}
  onpointerup={handlePointerUp}
  onpointermove={handlePointerMove}
  oncontextmenu={(e) => {
    e.preventDefault();
  }}
  fill="none"
  class="select-none touch-none w-full h-full absolute top-0 cursor-crosshair"
>
  {#each blockManager.previewPaths as segment}
    <path fill={segment.color} stroke="none" d={segment.path} />
  {/each}

  {#each blockManager.currentPreviewPaths as segment}
    <path d={segment.path} stroke={segment.color} fill={segment.color} />
  {/each}
</svg>
