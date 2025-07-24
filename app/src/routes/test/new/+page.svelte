<script lang="ts">
  import { StrokeBuilder } from "$lib/classes/StrokeBuilder.svelte";
  import { InputThrottler } from "$lib/classes/InputThrottler";

  let currentStrokeBuilder = $state<StrokeBuilder>(new StrokeBuilder(5));
  let paths = $state<string[]>([]);

  let drawing = $state(false);

  const throttler = new InputThrottler();

  function handlePointerDown(e: PointerEvent) {
    drawing = true;
    currentStrokeBuilder?.addPoint(e.clientX, e.clientY, e.pressure ?? 0.5);
  }
  async function handlePointerUp() {
    drawing = false;
    throttler.cancel();
    paths.push(await currentStrokeBuilder.finalizePath());

    currentStrokeBuilder.clear();
  }
  function handlePointerMove(e: PointerEvent) {
    if (!drawing) return;
    throttler.update(() => {
      currentStrokeBuilder?.addPoint(e.clientX, e.clientY, e.pressure ?? 0.5);
    });
  }

  $effect(() => {
    document.addEventListener("keydown", (e) => {
      if (e.key === "c") {
        currentStrokeBuilder?.clear();
        paths = [];
      } else if (e.key === "q") {
        window.location.replace("/test");
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
  class="select-none touch-none w-full h-full absolute top-0"
  stroke="#ffffff"
  fill="none"
>
  {#each paths as path}
    <path d={path} />
  {/each}

  <path d={currentStrokeBuilder?.immediatePath} />
</svg>
