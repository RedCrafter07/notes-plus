<script lang="ts">
  import { page } from "$app/state";
  import { getSvgPathFromStroke } from "$lib/util/getSvgPathFromStroke";
  import { getStroke } from "perfect-freehand";

  let drawing = $state(false);
  let points = $state<{ x: number; y: number; pressure: number }[]>([]);
  let preview = $state<string>();
  let canvas = $state<HTMLCanvasElement>();
  let ctx = $derived(canvas?.getContext("2d"));

  let width = $state(0);
  let height = $state(0);

  $effect(() => {
    preview = getSvgPathFromStroke(
      getStroke(points, {
        size: 8,
        thinning: 0,
        start: {
          cap: true,
          taper: 0,
        },
        end: {
          cap: true,
          taper: 0,
        },
        last: drawing === false,
      }),
    );
  });

  function translateToRelative(x: number, y: number, pressure: number = 0.5) {
    return { x: x - width / 2, y: y - height / 2, pressure };
  }

  function drawOnCanvas() {
    if (!ctx) return;
    const path = new Path2D(preview);

    ctx.resetTransform();
    ctx.translate(width / 2, height / 2);

    ctx.fillStyle = "background-color: black;";
    ctx?.fill(path);
  }
</script>

<div
  class="bg-white w-full h-screen relative"
  bind:clientWidth={width}
  bind:clientHeight={height}
  onpointerdown={(e) => {
    drawing = true;
    points.push(translateToRelative(e.clientX, e.clientY));
  }}
  onpointerup={() => {
    drawing = false;
    drawOnCanvas();
    points = [];
  }}
  onpointermove={(e) => {
    if (drawing) points.push(translateToRelative(e.clientX, e.clientY));
  }}
  role="document"
>
  <canvas
    class="absolute w-full h-full top-0"
    {width}
    {height}
    bind:this={canvas}
  ></canvas>
  <svg
    class="w-full h-full absolute top-0"
    viewBox={`${translateToRelative(0, 0).x} ${translateToRelative(0, 0).y} ${width} ${height}`}
  >
    <path d={preview} fill="black" />
  </svg>
</div>
