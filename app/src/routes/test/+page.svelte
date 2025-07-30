<script lang="ts">
  import { StrokeManager } from "$lib/canvas/StrokeManager.svelte";

  let strokeManager = $state(new StrokeManager());

  function handlePointerDown(e: PointerEvent) {
    strokeManager.inputLocked = false;
    strokeManager.input(e.clientX, e.clientY, e.pressure ?? 0.5);
  }
  function handlePointerUp() {
    strokeManager.inputLocked = true;
    strokeManager.finishInput();
  }
  function handlePointerMove(e: PointerEvent) {
    switch (e.buttons) {
      case 32:
        strokeManager.changeTool("eraser");
        break;
      case 2:
        // TODO: Barrel button -> selection
        break;
      default:
        strokeManager.changeTool("pen");
        break;
    }
    if (e.pressure > 0)
      strokeManager.input(e.clientX, e.clientY, e.pressure ?? 0.5);
  }

  $effect(() => {
    document.addEventListener("keydown", (e) => {
      if (e.key === "c") {
        strokeManager = new StrokeManager();
      } else if (e.key === "e") {
        strokeManager.changeTool("eraser");
      } else if (e.key === "p") {
        strokeManager.changeTool("pen");
      }
    });
  });
</script>

<div class="top-0 absolute z-50">
  <p>Current Tool: {strokeManager.tool.type}</p>
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
  {#each strokeManager.previewPaths as segment}
    <path fill={segment.color} stroke="none" d={segment.path} />
  {/each}

  {#each strokeManager.currentPreviewPaths as segment}
    <path d={segment.path} stroke={segment.color} fill={segment.color} />
  {/each}
</svg>
