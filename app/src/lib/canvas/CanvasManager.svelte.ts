import type { Metadata } from "$lib/types/bindings/Metadata";
import type { Note } from "$lib/types/bindings/Note";
import type { SimplePoint } from "$lib/types/canvas";
import { LayerManager } from "./LayerManager.svelte";

export class CanvasManager {
  private static readonly PAGE_SIZES = {
    A4: { width: 595.28, height: 841.89 }, // 210mm x 297mm
    Letter: { width: 612, height: 792 }, // 8.5" x 11"
    Legal: { width: 612, height: 1008 }, // 8.5" x 14"
    A3: { width: 841.89, height: 1190.55 }, // 297mm x 420mm
    A5: { width: 419.53, height: 595.28 }, // 148mm x 210mm
  } as const;

  layerManager = new LayerManager(); // Layers handled by LayerManager

  #meta: Metadata = $state({
    createdAt: Date.now().toString(),
    lastModified: Date.now().toString(),
    tags: [],
    title: "New Note",
    id: crypto.randomUUID(),
  });

  #position: SimplePoint = $state({ x: 0, y: 0 });
  #zoom: number = $state(100); // Percentage; 100 is the default
  #viewport: { width: number; height: number } = $state({
    width: 0,
    height: 0,
  });

  #canvasMode: "fixed" | "infinite" = $state("fixed");
  #pageSize = $state(CanvasManager.PAGE_SIZES.A4);

  constructor(data?: Note, viewport?: { width: number; height: number }) {
    if (viewport) this.#viewport = viewport;
    if (data) this.import(data);
  }

  public screenToSvg(screen: SimplePoint): SimplePoint {
    const relative: SimplePoint = {
      x: screen.x - this.#viewport.width / 2,
      y: screen.y - this.#viewport.height / 2,
    };

    const zoomFactor = this.#zoom / 100;
    const scaled: SimplePoint = {
      x: relative.x / zoomFactor,
      y: relative.y / zoomFactor,
    };

    const panOffset: SimplePoint = {
      x: scaled.x + this.#position.x,
      y: scaled.y + this.#position.y,
    };

    return panOffset;
  }

  public svgToScreen(point: SimplePoint): SimplePoint {
    const panOffset: SimplePoint = {
      x: point.x - this.#position.x,
      y: point.y - this.#position.y,
    };

    const zoomFactor = this.#zoom / 100;

    const unscaled: SimplePoint = {
      x: panOffset.x * zoomFactor,
      y: panOffset.y * zoomFactor,
    };

    const absolute: SimplePoint = {
      x: unscaled.x + this.#viewport.width / 2,
      y: unscaled.y + this.#viewport.height / 2,
    };

    return absolute;
  }

  public input(x: number, y: number, pressure: number) {
    const pageCoordinates = this.screenToSvg({ x, y });

    if (this.isInPage(pageCoordinates))
      this.layerManager.input(pageCoordinates.x, pageCoordinates.y, pressure);
  }
  public finishInput() {
    this.layerManager.finishInput();
  }

  private isInPage(point: SimplePoint) {
    if (this.#canvasMode === "infinite") return true;

    const bounds = this.pageBounds!;

    return (
      point.x >= bounds.left &&
      point.x <= bounds.right &&
      point.y >= bounds.top &&
      point.y <= bounds.bottom
    );
  }

  // Zooming / Panning
  public zoomAt(x: number, y: number, factor: number) {
    const pointBeforeZoom = this.screenToSvg({ x, y });

    this.#zoom = Math.max(10, Math.min(1000, this.#zoom * factor));

    const pointAfterZoom = this.screenToSvg({ x, y });

    this.#position.x += pointBeforeZoom.x - pointAfterZoom.x;
    this.#position.y += pointBeforeZoom.y - pointAfterZoom.y;
  }

  public pan(x: number, y: number) {
    this.#position.x += x;
    this.#position.y += y;
  }

  public import(data: Note) {
    const { layers, metadata, lastState } = data;

    this.#meta = metadata;
    this.layerManager.import(layers, lastState.lastLayer);
  }

  public export(): Note {
    return {
      layers: this.layerManager.export(),
      lastState: {
        position: [0, 0],
        zoom: 100,
        lastLayer: this.layerManager.selectedLayerIndex,
      },
      metadata: this.#meta,
    };
  }

  public setViewport(width: number, height: number) {
    this.#viewport = { width, height };
  }

  public get title() {
    return this.#meta.title;
  }
  public get pageBounds() {
    if (this.#canvasMode === "infinite") return null; // duh

    const halfWidth = this.#pageSize.width / 2;
    const halfHeight = this.#pageSize.height / 2;

    return {
      left: -halfWidth,
      right: halfWidth,
      top: -halfHeight,
      bottom: halfHeight,
      width: this.#pageSize.width,
      height: this.#pageSize.height,
    };
  }

  public get viewBoxString(): string {
    const zoomFactor = this.#zoom / 100;

    const visibleWidth = this.#viewport.width / zoomFactor;
    const visibleHeight = this.#viewport.height / zoomFactor;

    const left = this.#position.x - visibleWidth / 2;
    const top = this.#position.y - visibleHeight / 2;

    return `${left} ${top} ${visibleWidth} ${visibleHeight}`;
  }
}
