<script lang="ts">
  import {
    IconEraser,
    IconLasso,
    IconPencil,
    IconZoomCancel,
    IconZoomCheck,
  } from "@tabler/icons-svelte";
  import { canvasManager, type Tool } from "./state/canvasManager.svelte";
  import ColorPicker from "$lib/components/ColorPicker.svelte";
  import { fly } from "svelte/transition";
  import { cubicInOut } from "svelte/easing";

  let color = $state(canvasManager.color);

  const tools: {
    id: Tool;
    icon: typeof IconEraser;
  }[] = [
    {
      id: "pen",
      icon: IconPencil,
    },
    {
      id: "eraser",
      icon: IconEraser,
    },
    {
      id: "lasso",
      icon: IconLasso,
    },
  ];

  $effect(() => {
    canvasManager.color = color;
  });
</script>

{#snippet penToolbar()}
  <!-- color -->
  <ColorPicker bind:value={color} />
  <!-- <button onclick={() => {
    
  }} tabindex="-1" title="Current Thickness">
    <div
      class="aspect-square rounded-full bg-content-1"
      style="width: {canvasManager.thickness}px;"
    ></div>
  </button> -->
  <button
    onclick={() => {
      canvasManager.zoomLock = !canvasManager.zoomLock;
    }}
  >
    {#if canvasManager.zoomLock}
      <IconZoomCheck />
    {:else}
      <IconZoomCancel />
    {/if}
  </button>
{/snippet}

<div class="top-0 right-4 flex h-full pointer-events-none absolute flex-row">
  <div class="grid grid-cols-1 grid-rows-1 items-start justify-items-start">
    {#if canvasManager.tool === "pen"}
      <div
        style="grid-area: 1 / 1;"
        class="p-4 w-10 rounded-l-xl bg-base-3 flex flex-col gap-4 my-auto items-center justify-center pointer-events-auto z-0"
        transition:fly={{ duration: 150, easing: cubicInOut, x: "100%" }}
      >
        {@render penToolbar()}
      </div>
    {/if}
  </div>
  <div
    class="p-2 w-14 rounded-xl bg-base-1 flex flex-col gap-1 my-auto pointer-events-auto items-center justify-center z-10"
  >
    {#each tools as tool}
      {@const Icon = tool.icon}
      <button
        class={[
          "aspect-square p-2 rounded-xl transition-all border-transparent border-2 mx-2",
          {
            "bg-overlay/25": canvasManager.tool === tool.id,
            "border-warning bg-warning/25 text-warning":
              canvasManager.tool === tool.id && canvasManager.lockTool,
          },
        ]}
        onclick={() => {
          if (canvasManager.tool === tool.id) {
            canvasManager.lockTool = !canvasManager.lockTool;
          } else {
            canvasManager.lockTool = false;
            canvasManager.tool = tool.id;
          }
        }}
      >
        <Icon />
      </button>
    {/each}
  </div>
</div>
