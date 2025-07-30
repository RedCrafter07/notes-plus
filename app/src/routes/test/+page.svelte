<script lang="ts">
  import { BlockManager } from "$lib/canvas/BlockManager.svelte";

  let blockManager = $state(new BlockManager());

  function handlePointerDown(e: PointerEvent) {
    blockManager.inputLocked = false;
    blockManager.input(e.clientX, e.clientY, e.pressure ?? 0.5);
  }
  function handlePointerUp() {
    blockManager.inputLocked = true;
    blockManager.finishInput();
  }
  function handlePointerMove(e: PointerEvent) {
    switch (e.buttons) {
      case 32:
        blockManager.changeTool("eraser");
        break;
      case 2:
        // TODO: Barrel button -> selection
        break;
      default:
        blockManager.changeTool("pen");
        break;
    }
    if (e.pressure > 0)
      blockManager.input(e.clientX, e.clientY, e.pressure ?? 0.5);
  }

  $effect(() => {
    document.addEventListener("keydown", (e) => {
      if (e.key === "c") {
        blockManager = new BlockManager();
      } else if (e.key === "e") {
        blockManager.changeTool("eraser");
      } else if (e.key === "p") {
        blockManager.changeTool("pen");
      }
    });
  });
</script>

<div class="top-0 absolute z-50">
  <p>Current Tool: {blockManager.tool.type}</p>
</div>

<svg
  role="document"
  width="100%"
  height="100%"
  onpointerdown={handlePointerDown}
  onpointerup={handlePointerUp}
  onpointermove={handlePointerMove}
  onpointerover={(e) => {
    console.log("Stylus Debug:", {
      pointerType: e.pointerType,
      pressure: e.pressure,
      buttons: e.buttons,
      button: e.button,
    });
  }}
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
