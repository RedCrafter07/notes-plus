<script lang="ts">
  import { contentManager } from "$lib/state/contentManager.svelte";
  import { tabManager } from "$lib/state/tabManager.svelte";
  import { commands, type Block, type Point } from "$lib/tauri/bindings";
  import { erase } from "$lib/util/erase";
  import { getSvgPathFromStroke } from "$lib/util/getSvgPathFromStroke";
  import { runSelection, type LassoSelection } from "$lib/util/lasso";
  import { getStroke } from "perfect-freehand";
  import { tick } from "svelte";
  import { fade } from "svelte/transition";

  let dpr = $state(typeof window !== "undefined" ? window.devicePixelRatio : 1);

  let canvasWidth = $state(0);
  let canvasHeight = $state(0);

  const activeLayerID = $derived(
    contentManager.layers[contentManager.activeLayer].id,
  );

  let drawing = $state(false);
  let pointerType = $state("mouse");
  let layers = $derived(contentManager.layers);
  let layerCtx = $state<Record<string, CanvasRenderingContext2D>>({});

  let cursorX = $state(0);
  let cursorY = $state(0);
  let cursorVisible = $state(false);

  // used for panning
  let touchX = $state(0);
  let touchY = $state(0);
  // pinch
  let initialPinchDistance = $state(1);

  let currentButton = $state(-1);

  let color = $state("#000000");
  let thickness = $state(8);
  let points = $state<Point[]>([]);
  let tool = $state<"pen" | "eraser" | "lasso">("pen");
  let eraserRadius = $state(24);
  let lockTool = $state(false);

  let preview = $state<string>();

  let isSelecting = $state(true);
  let lassoPoints = $state<Point[]>([]);
  let lassoSelection = $state<LassoSelection>();
  let selectedLayers = $derived(
    lassoSelection ? Object.keys(lassoSelection) : [],
  );
  let selectionBoundingBox = $derived(getSelectionBoundingBox(selectedLayers));

  let svgViewBox = $derived(
    `${translateToRelative(0, 0).x} ${translateToRelative(0, 0).y} ${canvasWidth / contentManager.zoom} ${canvasHeight / contentManager.zoom}`,
  );

  let dragOffsetX = $state(0);
  let dragOffsetY = $state(0);
  let dragStart = $state({ x: 0, y: 0 });

  let isDraggingSelection = $state(false);
  let scaleFactor = $state(1);

  function updateSelection() {
    lassoSelection = runSelection(lassoPoints);
    redrawStrokes();
  }

  function getSelectionBoundingBox(selectedLayers: string[]) {
    if (!lassoSelection) return;

    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    selectedLayers
      .flatMap((l) => lassoSelection![l])
      .flatMap((v) => v.block.Stroke.points)
      .forEach((p) => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });

    if (minX === Infinity) return { x: 0, y: 0, width: 0, height: 0 };

    minX -= thickness / 2;
    minY -= thickness / 2;
    maxX += thickness / 2;
    maxY += thickness / 2;

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

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

      if (e.key === "s" && !e.shiftKey && contentManager.path !== null) {
        const saveSuccess = await commands.saveNote(contentManager.export());
        if (saveSuccess) {
          if (tabManager.activeNote) tabManager.activeNote.unsaved = false;
        } else {
          // TODO: Display error
        }
      }
      if (
        e.key === "S" ||
        (e.key === "s" && e.shiftKey) ||
        (e.key === "s" && !e.shiftKey && contentManager.path === null)
      ) {
        if (!tabManager.activeNote) return;
        const id = contentManager.path
          ? crypto.randomUUID()
          : contentManager.id;

        contentManager.id = id;

        const path = await commands.saveNoteDialog(contentManager.export());

        if (path) {
          contentManager.path = path;
          if (tabManager.activeNote) tabManager.activeNote.unsaved = false;
        }
      }
    };
    document.addEventListener("keydown", event);

    return () => {
      document.removeEventListener("keydown", event);
    };
  });

  function translateToRelative(x: number, y: number, pressure: number = 0.5) {
    x = x - canvasWidth / 2;
    y = y - canvasHeight / 2;

    x = x / contentManager.zoom;
    y = y / contentManager.zoom;

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
      const selectedStrokes = lassoSelection
        ? (lassoSelection[l.id] ?? [])
        : [];

      const strokes = l.blocks
        .filter((b) => b.Stroke !== undefined)
        .map((b) => b.Stroke)
        .filter(
          (s) => !selectedStrokes.some((sel) => sel.block.Stroke.id === s.id),
        );

      const ctx = layerCtx[l.id];

      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      ctx.translate(canvasWidth / 2, canvasHeight / 2);
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
      ctx.resetTransform();
      ctx.clearRect(0, 0, canvasWidth * dpr, canvasHeight * dpr);
      ctx.restore();
    }
  }

  function finishStroke() {
    drawOnCanvas(inputToPath(points));
    if (points.length === 0) return;

    layers[contentManager.activeLayer].blocks.push({
      Stroke: {
        id: crypto.randomUUID(),
        color,
        thickness,
        points,
      },
    });

    tabManager.setEdited();

    points = [];
  }

  function getPinchDistance(x1: number, y1: number, x2: number, y2: number) {
    return Math.hypot(x1 - x2, y1 - y2);
  }

  function getCenter(x1: number, y1: number, x2: number, y2: number) {
    return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
  }

  function eraser(x: number, y: number) {
    layers.forEach((l, i) => {
      if (l.locked || !l.visible) return l;

      const blocks = l.blocks.flatMap((b) => {
        if (b.Stroke) {
          const s = b.Stroke;
          if (s.points.length === 1) return b;
          if (s.points.length === 0) return [];
          const newPoints = erase(
            s.points,
            translateToRelative(x, y, 0.5),
            eraserRadius,
          );

          return newPoints.map(
            (p) =>
              ({
                Stroke: {
                  ...s,
                  id: crypto.randomUUID(),
                  points: p,
                },
              }) satisfies Block,
          );
        } else return b;
      });

      contentManager.layers[i] = {
        ...l,
        blocks,
      };
    });
  }

  function updateDrag() {
    if (!lassoSelection) return;
    // update blocks in selection object
    selectedLayers.forEach((l) => {
      const contents = lassoSelection![l];
      lassoSelection![l] = contents.map((c) => ({
        ...c,
        block: {
          Stroke: {
            ...c.block.Stroke,
            points: c.block.Stroke.points.map((p) => ({
              ...p,
              x: p.x + dragOffsetX,
              y: p.y + dragOffsetY,
            })),
          },
        },
      }));
    });

    // fill into content manager
    selectedLayers.forEach((lID) => {
      const i = contentManager.layers.findIndex((l) => l.id === lID);
      if (i >= 0) {
        const selectedLayer = lassoSelection![lID];
        const newBlocks = contentManager.layers[i].blocks;

        selectedLayer.forEach((l) => {
          newBlocks[l.index] = l.block;
        });

        contentManager.layers[i].blocks = newBlocks;
      }
    });

    dragOffsetX = 0;
    dragOffsetY = 0;

    redrawStrokes();
  }
</script>

<div
  class="bg-white w-full h-screen relative touch-none hide-cursor overflow-hidden"
  bind:clientWidth={canvasWidth}
  bind:clientHeight={canvasHeight}
  class:hide-cursor={!(!isSelecting && tool === "lasso")}
  onpointerenter={(e) => {
    cursorX = e.offsetX;
    cursorY = e.offsetY;

    cursorVisible = true;
  }}
  onpointerleave={() => {
    cursorVisible = false;
    currentButton = -1;
    if (tool === "lasso") {
      if (!lassoSelection) isSelecting = true;
      if (isSelecting) updateSelection();
      else {
        const noSelection = !selectedLayers.some(
          (l) => lassoSelection![l].length > 0,
        );

        isSelecting = noSelection;
        if (noSelection) lassoPoints = [];
      }
    }
    if (drawing) {
      drawing = false;
      finishStroke();
    }
  }}
  onpointerdown={(e) => {
    if (tool === "lasso" && !isSelecting) {
      const cursorRelative = translateToRelative(e.offsetX, e.offsetY);

      if (
        selectionBoundingBox &&
        cursorRelative.x >= selectionBoundingBox.x &&
        cursorRelative.x <=
          selectionBoundingBox.x + selectionBoundingBox.width &&
        cursorRelative.y >= selectionBoundingBox.y &&
        cursorRelative.y <= selectionBoundingBox.y + selectionBoundingBox.height
      ) {
        isDraggingSelection = true;
        dragStart = cursorRelative;
        return;
      } else {
        lassoPoints = [];
        isSelecting = true;
        dragOffsetX = 0;
        dragOffsetY = 0;
        scaleFactor = 1;
        lassoSelection = undefined;
        redrawStrokes();
      }
    }
    pointerType = e.pointerType;
    currentButton = e.button;
    if (!lockTool) {
      switch (e.button) {
        case 0:
          tool = "pen";
          break;

        case 1:
          tool = "lasso";
          break;

        case 5:
          tool = "eraser";
          break;
      }
    }
    if (tool !== "lasso") isSelecting = true;
    if (e.button === 0 && pointerType !== "touch" && tool === "pen") {
      drawing = true;
      points.push(translateToRelative(e.offsetX, e.offsetY, e.pressure ?? 0.5));
    } else if (tool === "eraser") {
      eraser(e.offsetX, e.offsetY);
    } else if (tool === "lasso") {
      lassoPoints = [];
      redrawStrokes();
      isSelecting = true;
    }
  }}
  onpointerup={() => {
    if (tool === "lasso") {
      if (isDraggingSelection) {
        isDraggingSelection = false;
        dragStart = { x: 0, y: 0 };
        updateDrag();
      } else if (isSelecting) {
        updateSelection();
        if (!lassoSelection) {
          isSelecting = true;
          lassoPoints = [];
        } else {
          const noSelection = !selectedLayers.some(
            (l) => lassoSelection![l].length > 0,
          );
          isSelecting = noSelection;
          if (noSelection) lassoPoints = [];
        }
      }
    }

    currentButton = -1;
    drawing = false;
    finishStroke();
  }}
  onpointermove={(e) => {
    if (isDraggingSelection) {
      dragOffsetX = dragOffsetX + (e.offsetX - cursorX) / contentManager.zoom;
      dragOffsetY = dragOffsetY + (e.offsetY - cursorY) / contentManager.zoom;
    }
    cursorX = e.offsetX;
    cursorY = e.offsetY;
    switch (currentButton) {
      case 0:
        {
          if (drawing)
            points.push(
              translateToRelative(e.offsetX, e.offsetY, e.pressure ?? 0.5),
            );
          else if (tool === "eraser") {
            eraser(e.offsetX, e.offsetY);
          } else if (tool === "lasso") {
            lassoPoints.push(
              translateToRelative(e.offsetX, e.offsetY, e.pressure),
            );
          }
        }
        break;
      case 5:
        eraser(e.offsetX, e.offsetY);
        break;

      case 1:
        {
          if (tool === "lasso") {
            lassoPoints.push(
              translateToRelative(e.offsetX, e.offsetY, e.pressure),
            );
          }
        }
        break;
    }
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
  ontouchstart={(e) => {
    if (pointerType !== "touch") return;
    switch (e.touches.length) {
      case 1:
        e.preventDefault();
        touchX = e.touches[0].clientX;
        touchY = e.touches[0].clientY;
        break;
      case 2:
        const { clientX: x1, clientY: y1 } = e.touches[0];
        const { clientX: x2, clientY: y2 } = e.touches[1];
        initialPinchDistance = getPinchDistance(x1, y1, x2, y2);
        break;
    }
  }}
  ontouchmove={(e) => {
    if (pointerType !== "touch") return;
    switch (e.touches.length) {
      case 1:
        {
          const currentX = e.touches[0].clientX;
          const currentY = e.touches[0].clientY;

          const deltaX = currentX - touchX;
          const deltaY = currentY - touchY;

          contentManager.panX += deltaX / contentManager.zoom;
          contentManager.panY += deltaY / contentManager.zoom;

          touchX = currentX;
          touchY = currentY;

          redrawStrokes();
        }
        break;
      case 2:
        {
          const { clientX: x1, clientY: y1 } = e.touches[0];
          const { clientX: x2, clientY: y2 } = e.touches[1];
          let currentDistance = getPinchDistance(x1, y1, x2, y2);
          if (currentDistance <= 0) currentDistance = 1;

          const center = getCenter(x1, y1, x2, y2);
          // TODO: Pan to center of pinch
          const zoom = currentDistance / initialPinchDistance;

          contentManager.zoom *= zoom;

          initialPinchDistance = currentDistance;

          redrawStrokes();
        }
        break;
    }
  }}
  ontouchend={(e) => {
    if (e.touches.length === 1) {
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
    }
  }}
  role="document"
>
  <div
    class={[
      "absolute w-full h-full top-0 transition-all",
      {
        "contrast-20": tool === "lasso" && !isSelecting,
      },
    ]}
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
  </div>

  <svg class="w-full h-full absolute top-0" viewBox={svgViewBox}>
    <path d={preview} fill={color} />
    {#if lassoSelection}
      <g transform="translate({dragOffsetX}, {dragOffsetY})">
        {#each selectedLayers as l}
          {#each lassoSelection[l] as e}
            {@const stroke = e.block.Stroke}
            <path
              d={inputToPath(stroke.points, stroke.thickness)}
              fill={stroke.color}
            />
          {/each}
        {/each}
        <rect
          x={selectionBoundingBox?.x}
          y={selectionBoundingBox?.y}
          width={selectionBoundingBox?.width}
          height={selectionBoundingBox?.height}
          fill="transparent"
          stroke="var(--base-1)"
          stroke-dasharray={`${5 / contentManager.zoom}`}
          stroke-width={2 / contentManager.zoom}
          class="cursor-move pointer-events-auto"
          role="group"
        />
      </g>
    {/if}
    {#if tool === "lasso" && lassoPoints.length > 0 && isSelecting}
      <path
        out:fade={{ duration: 100 }}
        d={"M " + lassoPoints.map((p) => `${p.x},${p.y}`).join(" L ") + " Z"}
        fill="rgba(0, 120, 255, 0.1)"
        stroke="#0078FF"
        stroke-width={2 / contentManager.zoom}
        stroke-dasharray={`${5 / contentManager.zoom}, ${5 / contentManager.zoom}`}
      />
    {/if}
  </svg>

  {#if cursorVisible && !(tool === "lasso" && !isSelecting)}
    <div
      class={[
        "rounded-full aspect-square absolute pointer-events-none opacity-50",
        {
          "border border-destructive": tool === "eraser",
        },
      ]}
      style="width: {tool === 'eraser'
        ? eraserRadius * 2 * contentManager.zoom
        : tool === 'pen'
          ? thickness
          : 8}px; background-color: {tool === 'pen'
        ? color
        : tool === 'eraser'
          ? '#ffffff'
          : '#99ccff'}; top: {cursorY -
        (tool === 'eraser'
          ? eraserRadius * contentManager.zoom
          : tool === 'pen'
            ? thickness / 2
            : 4)}px; left:{cursorX -
        (tool === 'eraser'
          ? eraserRadius * contentManager.zoom
          : tool === 'pen'
            ? thickness / 2
            : 4)}px;"
    ></div>
  {/if}
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

<button
  class="absolute right-4 top-16 p-2 rounded-xl bg-destructive text-destructive-content"
  onclick={() => {
    tool = tool === "pen" ? "eraser" : "pen";
    lockTool = true;
  }}
>
  Toggle pen/eraser
</button>

<button
  class="absolute right-4 top-28 p-2 rounded-xl bg-info text-info-content"
  onclick={() => {
    tool = tool === "lasso" ? "pen" : "lasso";
    lockTool = true;
  }}
>
  Toggle lasso
</button>
