<script lang="ts">
  import { contentManager } from "$lib/state/contentManager.svelte";
  import { commands, type Point } from "$lib/tauri/bindings";
  import { getSvgPathFromStroke } from "$lib/util/getSvgPathFromStroke";
  import { getStroke } from "perfect-freehand";
  import { tick } from "svelte";

  let dpr = $state(typeof window !== "undefined" ? window.devicePixelRatio : 1);

  let canvasWidth = $state(0);
  let canvasHeight = $state(0);

  const activeLayerID = $derived(
    contentManager.layers[contentManager.activeLayer].id,
  );

  let drawing = $state(false);
  let layers = $derived(contentManager.layers);
  let layerCtx = $state<Record<string, CanvasRenderingContext2D>>({});

  let color = $state("#000000");
  let thickness = $state(8);
  let points = $state<Point[]>([]);

  let preview = $state<string>();

  let svgViewBox = $derived(
    `${translateToRelative(0, 0).x} ${translateToRelative(0, 0).y} ${canvasWidth / contentManager.zoom} ${canvasHeight / contentManager.zoom}`,
  );

  $effect(() => {
    canvasWidth;
    canvasHeight;
    contentManager.zoom;
    contentManager.panX;
    contentManager.panY;
  });

  function assignContext(element: HTMLCanvasElement, id: string) {
    const ctx = element.getContext("2d");
    if (!ctx) {
      console.error("Fatal error: Couldn't get canvas context");
      return;
    }

    layerCtx[id] = ctx;
  }

  $effect(() => {
    redrawStrokes();
  });

  $effect(() => {
    preview = inputToPath(points);
  });

  $effect(() => {
    canvasWidth;
    canvasHeight;
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
    x = x - canvasWidth / (2 * dpr);
    y = y - canvasHeight / (2 * dpr);

    x = x / contentManager.zoom;
    y = y / contentManager.zoom;

    // 3. Invert the Camera Pan
    x = x - contentManager.panX;
    y = y - contentManager.panY;

    return {
      x,
      y,
      pressure,
    };
  }

  function redrawStrokes() {
    if (drawing) return;
    clearCanvas();

    layers.forEach((l) => {
      const strokes = l.blocks
        .filter((b) => b.Stroke !== undefined)
        .map((b) => b.Stroke);

      const ctx = layerCtx[l.id];

      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      ctx.translate(canvasWidth / 2, canvasHeight / 2);

      // zoom/pan
      ctx.scale(contentManager.zoom, contentManager.zoom);
      ctx.translate(contentManager.panX, contentManager.panY);

      for (const { color, points, thickness } of strokes) {
        drawOnCanvas(inputToPath(points, thickness), color);
      }
    });
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
    const ctx = layerCtx[activeLayerID];
    if (!ctx) return;
    if (typeof path === "string") path = new Path2D(path);

    ctx.fillStyle = c;
    ctx?.fill(path);
  }

  function clearCanvas() {
    for (const id in layerCtx) {
      const ctx = layerCtx[id];

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.restore();
    }
  }

  function finishStroke() {
    drawOnCanvas(inputToPath(points));

    layers[contentManager.activeLayer].blocks.push({
      Stroke: {
        color,
        thickness,
        points,
      },
    });

    points = [];
  }
</script>

<div
  class="bg-white w-full h-screen relative touch-none"
  bind:clientWidth={canvasWidth}
  bind:clientHeight={canvasHeight}
  onpointerdown={(e) => {
    drawing = true;
    points.push(translateToRelative(e.offsetX, e.offsetY, e.pressure ?? 0.5));
  }}
  onpointerup={() => {
    drawing = false;
    finishStroke();
  }}
  onpointermove={(e) => {
    if (drawing)
      points.push(translateToRelative(e.offsetX, e.offsetY, e.pressure ?? 0.5));
  }}
  onwheel={(e) => {
    if (e.ctrlKey) {
      if (e.deltaY > 0) {
        contentManager.zoom /= Math.abs(e.deltaY / 90);
      } else {
        contentManager.zoom *= Math.abs(e.deltaY / 90);
      }
    } else {
      let x = e.shiftKey ? e.deltaY : e.deltaX;
      let y = e.shiftKey ? e.deltaX : e.deltaY;

      contentManager.panX -= x;
      contentManager.panY -= y;
    }
    redrawStrokes();
  }}
  role="document"
>
  {#each layers as layer (`layer-${layer.id}`)}
    <canvas
      class="absolute w-full h-full top-0"
      style="width: {canvasWidth}px; height: {canvasHeight}px;"
      width={canvasWidth * dpr}
      height={canvasHeight * dpr}
      class:opacity-0={!layer.visible}
      use:assignContext={layer.id}
    ></canvas>
  {/each}

  <svg class="w-full h-full absolute top-0" viewBox={svgViewBox}>
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
