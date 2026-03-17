<script lang="ts">
  import {
    commands,
    type Block,
    type Note,
    type Point,
    type Stroke,
  } from "$lib/tauri/bindings";
  import { getSvgPathFromStroke } from "$lib/util/getSvgPathFromStroke";
  import { getStroke } from "perfect-freehand";

  let dpr = $state(typeof window !== "undefined" ? window.devicePixelRatio : 1);

  let title = $state("Arnold Testus 2");
  let tags = $state<string[]>([]);
  let createdAt = $state(Math.floor(Date.now() / 1000));
  let id = $state(crypto.randomUUID());
  let path = $state<string | undefined>();

  let width = $state(0);
  let height = $state(0);

  let drawing = $state(false);
  let canvas = $state<HTMLCanvasElement>();
  let ctx = $derived(canvas?.getContext("2d"));

  let strokes = $state<Stroke[]>([]);

  let color = $state("#000000");
  let thickness = $state(8);
  let points = $state<Point[]>([]);

  let preview = $state<string>();

  $effect(() => {
    preview = inputToPath(points);
  });

  $effect(() => {
    width;
    height;
    redrawStrokes();
  });

  $effect(() => {
    const event = async (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;

      if (e.key == "s") {
        await commands.saveNoteDialog(serializeData());
      }
    };
    document.addEventListener("keydown", event);

    return () => {
      document.removeEventListener("keydown", event);
    };
  });

  function translateToRelative(x: number, y: number, pressure: number = 0.5) {
    return { x: x - width / (2 * dpr), y: y - height / (2 * dpr), pressure };
  }

  function redrawStrokes() {
    if (drawing) return;

    for (const { color, points, thickness } of strokes) {
      drawOnCanvas(inputToPath(points, thickness), color);
    }
  }

  function inputToPath(inputPoints: Point[], t = thickness): string {
    return getSvgPathFromStroke(
      getStroke(inputPoints, {
        size: t,
        thinning: 0,
        last: drawing === false,
      }),
    );
  }

  function drawOnCanvas(path: string | Path2D, c = color) {
    if (!ctx) return;
    if (typeof path === "string") path = new Path2D(path);

    ctx.resetTransform();
    ctx.translate(width / 2, height / 2);
    ctx.scale(dpr, dpr);

    ctx.fillStyle = c;
    ctx?.fill(path);
  }

  function finishStroke() {
    drawOnCanvas(inputToPath(points));
    strokes.push({
      color,
      thickness,
      points,
    });
    points = [];
  }

  async function save() {}

  function serializeData(): Note {
    const blocks: Block[] = [
      ...strokes.map(
        (s) =>
          ({
            Stroke: s,
          }) as Block,
      ),
    ];

    return {
      blocks,
      created_at: createdAt,
      edited_at: Math.floor(Date.now() / 1000),
      tags,
      title,
    };
  }

  function createNoteData() {}
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
    finishStroke();
  }}
  onpointermove={(e) => {
    if (drawing) points.push(translateToRelative(e.clientX, e.clientY));
  }}
  role="document"
>
  <canvas
    class="absolute w-full h-full top-0"
    style="width: {width}px; height: {height}px;"
    width={width * dpr}
    height={height * dpr}
    bind:this={canvas}
  ></canvas>

  <svg
    class="w-full h-full absolute top-0"
    viewBox={`${translateToRelative(0, 0).x} ${translateToRelative(0, 0).y} ${width} ${height}`}
  >
    <path d={preview} fill={color} />
  </svg>
</div>
<button
  class="absolute right-4 top-4 p-2 rounded-xl bg-destructive text-destructive-content"
  onclick={() => {
    if (color === "#000000") color = "#ff3434";
    else color = "#000000";
  }}
>
  Toggle color
</button>
