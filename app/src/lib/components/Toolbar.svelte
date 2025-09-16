<script lang="ts">
  import { eraserDefaults, penDefaults } from "$lib/canvas/BlockManager.svelte";
  import type { ToolSettings } from "$lib/types/canvas";
  import {
    IconEraser,
    IconHandMove,
    IconPencil,
    IconSettings,
  } from "@tabler/icons-svelte";

  let toolIndex = $state(0);
  let bgWidth = $state(0);
  let iconOffset = $derived(toolIndex * (bgWidth + 8));

  // TODO: Make tools use ToolStore, which will also work with user preferences to save tools across sessions
  let {
    // tool,
    updateTool,
  }: { tool: ToolSettings; updateTool: (newTool: ToolSettings) => void } =
    $props();
</script>

<div class="right-4 h-full absolute pointer-events-none flex z-20">
  <div
    class="h-max p-2 rounded-xl bg-base-2 border-base-3 border shadow-2xl flex flex-col gap-2 my-auto pointer-events-auto relative"
  >
    <div
      style="top: {iconOffset}px;"
      class="left-0 absolute w-full aspect-square p-2 pointer-events-none transition-all"
    >
      <div
        bind:clientWidth={bgWidth}
        class="bg-overlay/20 w-full aspect-square rounded-xl"
      ></div>
    </div>
    <button
      class={[
        "aspect-square p-2 rounded-xl active:scale-90 transition-all hover:bg-overlay/20",
      ]}
      onclick={() => {
        toolIndex = 0;
        updateTool({
          ...penDefaults,
        });
      }}
    >
      <IconPencil />
    </button>
    <button
      class={[
        "aspect-square p-2 rounded-xl active:scale-90 transition-all hover:bg-overlay/20",
      ]}
      onclick={() => {
        toolIndex = 1;
        updateTool({
          ...eraserDefaults,
        });
      }}
    >
      <IconEraser />
    </button>
    <!-- <button -->
    <!--   class={[ -->
    <!--     "aspect-square p-2 rounded-xl active:scale-90 transition-all hover:bg-overlay/20", -->
    <!--   ]} -->
    <!--   onclick={() => { -->
    <!--     toolIndex = 2; -->
    <!--     // TODO: Implement this -->
    <!--   }} -->
    <!-- > -->
    <!--   <IconHandMove /> -->
    <!-- </button> -->
    <button
      class={[
        "aspect-square p-2 rounded-xl active:scale-90 transition-all hover:bg-overlay/20",
      ]}
      onclick={() => {}}
    >
      <IconSettings />
    </button>
  </div>
</div>
