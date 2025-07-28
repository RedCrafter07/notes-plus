<script lang="ts">
  import { StrokeManager } from "$lib/canvas/StrokeManager.svelte";

  let strokeManager = $state(new StrokeManager());

  function handlePointerDown(e: PointerEvent) {
    strokeManager.inputLocked = false;
    strokeManager.input(e.clientX, e.clientY, e.pressure ?? 0.5);
  }
  async function handlePointerUp() {
    strokeManager.inputLocked = true;
    strokeManager.finishInput();
  }
  function handlePointerMove(e: PointerEvent) {
    strokeManager.input(e.clientX, e.clientY, e.pressure ?? 0.5);
  }

  $effect(() => {
    document.addEventListener("keydown", (e) => {
      if (e.key === "c") {
        strokeManager = new StrokeManager();
      }
    });
  });
</script>

<svg
  width="100%"
  height="100%"
  onpointerdown={handlePointerDown}
  onpointerup={handlePointerUp}
  onpointermove={handlePointerMove}
  fill="none"
  class="select-none touch-none w-full h-full absolute top-0"
>
  {#each strokeManager.previewPaths as path}
    <path fill="#fff" stroke="none" d={path} />
  {/each}

  {#each strokeManager.currentPreviewPaths as path}
    <path d={path} stroke="#fff" fill="#fff" />
  {/each}
</svg>
