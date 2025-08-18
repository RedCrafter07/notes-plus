import type { LastState } from "$lib/types/bindings/LastState";
import type { SimplePoint } from "$lib/types/canvas";
import { LayerManager } from "./LayerManager.svelte";
import { Page } from "./Page.svelte";

export class CanvasManager {
  #position: SimplePoint = $state({ x: 0, y: 0 });
  #zoom: number = $state(100); // Percentage; 100 is the default
  #viewport: { width: number; height: number } = $state({
    width: 0,
    height: 0,
  });

  backgroundColor = $state("#ffffff");
  #page = $state<Page>();
  #pageIndex: number = $state(0);
  #offset: number = $state(0);

  constructor(viewport?: { width: number; height: number }) {
    if (viewport) this.#viewport = viewport;
  }

  public screenToSvg(screen: SimplePoint): SimplePoint {
    const relative: SimplePoint = {
      x: screen.x - this.#viewport.width / 2,
      y: screen.y - this.#offset - this.#viewport.height / 2,
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

  public getSvgCoordinates(x: number, y: number) {
    const coords = this.screenToSvg({ x, y });
    if (this.isInPage(coords)) return coords;
    else return null;
  }

  private isInPage(point: SimplePoint) {
    if (this.#page?.pageType === "infinite") return true;

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

  public import(lastState: LastState) {
    const {
      lastPage,
      position: [x, y],
      zoom,
    } = lastState;

    this.#zoom = zoom;
    this.#position = { x, y };
    this.#pageIndex = lastPage;
  }

  public export(): LastState | null {
    if (!this.#page) return null;

    return {
      lastLayer: this.#page?.layerManager.selectedLayerIndex,
      lastPage: this.#pageIndex,
      position: [this.#position.x, this.#position.y],
      zoom: this.#zoom,
    };
  }

  public setPage(page: Page, pageIndex: number) {
    this.#page = page;
    this.#pageIndex = pageIndex;
  }

  public setViewport(width: number, height: number) {
    this.#viewport = { width, height };
  }

  public setOffset(offset: number) {
    this.#offset = offset;
  }

  public get pageBounds() {
    if (!this.#page) return null;
    if (this.#page.pageType === "infinite") return null; // duh

    const pageSize = this.#page?.pageSize;

    const halfWidth = pageSize.width / 2;
    const halfHeight = pageSize.height / 2;

    return {
      left: -halfWidth,
      right: halfWidth,
      top: -halfHeight,
      bottom: halfHeight,
      width: pageSize.width,
      height: pageSize.height,
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
