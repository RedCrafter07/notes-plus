<script lang="ts">
  import type { Mode } from "../types/canvas";

  const { data, mode }: { data: any; mode: Mode } = $props();
  let canvas = $state<HTMLCanvasElement>();
</script>

<canvas bind:this={canvas}></canvas>
