<script lang="ts">
  import { eraserDefaults, penDefaults } from "$lib/canvas/BlockManager.svelte";
  import type { ToolSettings } from "$lib/types/canvas";
  import { IconBallpen, IconEraser, IconPencil } from "@tabler/icons-svelte";
  import type { Icon } from "@tabler/icons-svelte";

  let {
    tool,
    updateTool,
  }: { tool: ToolSettings; updateTool: (newTool: ToolSettings) => void } =
    $props();
</script>

<div class="bottom-4 w-full absolute mx-auto pointer-events-none">
  <div
    class="w-max p-2 rounded-xl bg-base-2 border-base-3 border shadow-2xl flex flex-row gap-4 mx-auto pointer-events-auto"
  >
    <button
      class={[
        "aspect-square p-2 rounded-xl active:scale-90 transition-all hover:bg-content-3/10",
        { "bg-content-3/20": tool.type === "pen" },
      ]}
      onclick={() => {
        updateTool({
          ...penDefaults,
        });
      }}
    >
      <IconPencil />
    </button>
    <button
      class={[
        "aspect-square p-2 rounded-xl active:scale-90 transition-all hover:bg-content-3/10",
        { "bg-content-3/20": tool.type === "eraser" },
      ]}
      onclick={() => {
        updateTool({
          ...eraserDefaults,
        });
      }}
    >
      <IconEraser />
    </button>
  </div>
</div>
