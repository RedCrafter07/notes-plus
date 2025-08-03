import type { ContentBlock } from "$lib/types/bindings/ContentBlock";
import { BlockManager } from "./BlockManager.svelte";

export class LayerManager {
  #layers: BlockManager[] = $state([]);
  #inputLocked: boolean = true;
  #selectedLayerIndex: number = $state(0); // 0 => lowest layer

  constructor(layers?: ContentBlock[][]) {
    if (layers && layers.length > 0) {
      this.#layers = layers.map((b) => new BlockManager(b));
    } else {
      // Always ensure at least one layer exists
      this.#layers = [new BlockManager()];
      this.#selectedLayerIndex = 0;
    }
  }

  // Import/Export
  public import(layers: ContentBlock[][], lastLayer: number) {
    this.#layers = layers.map((b) => new BlockManager(b));
    this.#selectedLayerIndex = lastLayer;

    return this;
  }
  public export(): ContentBlock[][] {
    return this.#layers.map((l) => l.blocks);
  }

  // Pen input "passthrough"
  public input(x: number, y: number, pressure: number) {
    const manager = this.#layers[this.#selectedLayerIndex];

    if (!manager) throw new Error("Selected Layer could not be found");
    manager.input(x, y, pressure);
  }
  public async finishInput() {
    const manager = this.#layers[this.#selectedLayerIndex];

    if (!manager) throw new Error("Selected Layer could not be found");
    manager.finishInput();
  }

  public changeTool(
    ...args: Parameters<typeof BlockManager.prototype.changeTool>
  ) {
    this.#layers.forEach((l) => {
      l.changeTool(...args);
    });
  }

  // Layer Management
  public addLayer(overIndex: number | "last", withItems?: ContentBlock[]) {
    if (overIndex === this.#layers.length - 1 || overIndex === "last")
      this.#layers.unshift(new BlockManager(withItems));
    else if (overIndex === 0) this.#layers.push(new BlockManager(withItems));
    else this.#layers.splice(overIndex + 1, 0, new BlockManager(withItems));

    this.#selectedLayerIndex = Math.min(
      overIndex === "last" ? this.#layers.length - 1 : overIndex + 1,
      this.#layers.length - 1,
    );
  }

  public moveLayer(from: number, to: number): boolean {
    if (from === to) return false; // Didn't move
    if (from < 0 || to < 0) return false;
    if (from >= this.#layers.length || to >= this.#layers.length) return false;

    const layer = this.#layers.splice(from, 1)[0];
    this.#layers.splice(to, 0, layer);

    if (this.#selectedLayerIndex === from) this.#selectedLayerIndex = to;
    else if (from < this.#selectedLayerIndex && to >= this.#selectedLayerIndex)
      this.#selectedLayerIndex--;
    else if (from > this.#selectedLayerIndex && to <= this.#selectedLayerIndex)
      this.#selectedLayerIndex--;

    return true;
  }

  public moveLayerUp(index: number) {
    this.moveLayer(index, index + 1);
  }
  public moveLayerDown(index: number) {
    this.moveLayer(index, index - 1);
  }

  public removeLayer(index: number) {
    this.#layers.splice(index, 1);
    if (this.#selectedLayerIndex >= this.#layers.length)
      this.#selectedLayerIndex = Math.max(
        0,
        Math.min(this.#selectedLayerIndex - 1, this.#layers.length - 1),
      );
  }

  public duplicateLayer(index: number): number | null {
    const layer = this.#layers[index];
    if (!layer) return null;

    const duplicatedBlocks = layer.blocks.map((block) => ({
      ...block,
      id: crypto.randomUUID(),
    }));
    this.addLayer(index, duplicatedBlocks);
    return index + 1;
  }

  public clearAllLayers(): void {
    this.#layers = [new BlockManager()];
    this.#selectedLayerIndex = 0;
  }

  // General checkers, getters and setters
  public isEmpty(): boolean {
    return this.#layers.every((layer) => layer.blocks.length === 0);
  }

  public get inputLocked(): boolean {
    return this.#inputLocked;
  }
  public set inputLocked(value: boolean) {
    this.#layers.forEach((b) => {
      b.inputLocked = value;
    });
    this.#inputLocked = value;
  }

  get selectedLayerIndex() {
    return this.#selectedLayerIndex;
  }
  set selectedLayerIndex(layer: number) {
    this.#selectedLayerIndex = layer;
  }

  public getLayer(index: number): BlockManager | undefined {
    return this.#layers[index];
  }

  public get selectedLayer(): BlockManager {
    return this.#layers[this.#selectedLayerIndex];
  }

  public get layers(): readonly BlockManager[] {
    return this.#layers;
  }

  public get svgLayers() {
    return this.#layers.map((l) => l.previewPaths);
  }

  public get strokePreview() {
    return this.#layers[this.#selectedLayerIndex].currentPreviewPaths;
  }

  public get layerCount(): number {
    return this.#layers.length;
  }
}
