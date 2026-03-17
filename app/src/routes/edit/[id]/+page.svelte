<script lang="ts">
  import { commands, type Point } from "$lib/tauri/bindings";
  import { getSvgPathFromStroke } from "$lib/util/getSvgPathFromStroke";
  import { getStroke } from "perfect-freehand";
  import { contentManager } from "$lib/state/contentManager.svelte";
  import { tick } from "svelte";

  let dpr = $state(typeof window !== "undefined" ? window.devicePixelRatio : 1);

  let width = $state(0);
  let height = $state(0);

  let drawing = $state(false);
  let canvas = $state<HTMLCanvasElement>();
  let ctx = $derived(canvas?.getContext("2d"));

  // let strokes = $state<Stroke[]>([]);

  let color = $state("#000000");
  let thickness = $state(8);
  let points = $state<Point[]>([]);

  let preview = $state<string>();

  $effect(() => {
    redrawStrokes();
  });

  $effect(() => {
    preview = inputToPath(points);
  });

  $effect(() => {
    width;
    height;
    contentManager.id;

    (async () => {
      await tick();
      redrawStrokes();
    })();
  });

  $effect(() => {
    const event = async (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;

      if (e.key === "S" || (e.key === "s" && e.shiftKey)) {
        await commands.saveNoteDialog(contentManager.export());
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
    if (!ctx) return;

    clearCanvas();

    ctx.resetTransform();
    ctx.translate(width / 2, height / 2);
    ctx.scale(dpr, dpr);

    for (const { color, points, thickness } of contentManager.strokes) {
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

    ctx.fillStyle = c;
    ctx?.fill(path);
  }

  function clearCanvas() {
    if (!canvas || !ctx) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function finishStroke() {
    drawOnCanvas(inputToPath(points));

    contentManager.strokes.push({
      color,
      thickness,
      points,
    });

    points = [];
  }

  async function save() {}

  // function serializeData(): Note {
  //   const blocks: Block[] = [
  //     ...strokes.map(
  //       (s) =>
  //         ({
  //           Stroke: s,
  //         }) as Block,
  //     ),
  //   ];

  //   return {
  //     blocks,
  //     created_at: createdAt,
  //     edited_at: Math.floor(Date.now() / 1000),
  //     tags,
  //     title,
  //   };
  // }

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
