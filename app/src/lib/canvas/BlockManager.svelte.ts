import type { ContentBlock } from "$lib/types/bindings/ContentBlock";
import type {
  EraserSettings,
  PenSettings,
  ToolSettings,
} from "$lib/types/canvas";
import { InputThrottler } from "./InputThrottler";
import { StrokeBuilder } from "./StrokeBuilder.svelte";
import { StrokeEraser } from "./StrokeEraser";

export const penDefaults: PenSettings = {
  type: "pen",
  color: "#ffffff",
  width: 5,
};
export const eraserDefaults: EraserSettings = {
  type: "eraser",
  deleteStroke: true,
  width: 15,
};

export class BlockManager {
  blocks: ContentBlock[] = [];

  #toolSettings: ToolSettings = $state({
    type: "pen",
    color: "#ffffff",
    width: 5,
  });

  #inputLocked: boolean = true;
  #newStroke?: StrokeBuilder;

  #currentPreviewPaths: { color: string; path: string }[] = $state([]);
  #previewPaths: { color: string; path: string }[] = $state([]);

  #pointThrottler = new InputThrottler();

  public get inputLocked(): boolean {
    return this.#inputLocked;
  }
  public set inputLocked(value: boolean) {
    if (value === true) this.#pointThrottler.cancel();
    this.#inputLocked = value;
  }

  public changeTool(
    tool: "pen",
    settings?: Omit<Partial<PenSettings>, "type">,
  ): void;
  public changeTool(
    tool: "eraser",
    settings?: Omit<Partial<EraserSettings>, "type">,
  ): void;
  public changeTool(
    tool: "pen" | "eraser",
    settings?: Omit<Partial<ToolSettings>, "type">,
  ) {
    if (tool === "pen") {
      this.#toolSettings = {
        ...penDefaults,
        ...settings,
        type: "pen",
      };
    } else if (tool === "eraser") {
      this.#toolSettings = {
        ...eraserDefaults,
        ...settings,
        type: "eraser",
      };
    }
  }

  public input(x: number, y: number, pressure: number) {
    if (this.#inputLocked) return;

    const currentTool = this.#toolSettings;
    switch (currentTool.type) {
      case "pen":
        this.penInput(currentTool, x, y, pressure);
        break;
      case "eraser":
        this.eraserInput(currentTool, x, y);
        break;
    }
  }

  private penInput(
    settings: PenSettings,
    x: number,
    y: number,
    pressure: number,
  ) {
    if (!this.#newStroke) {
      this.#newStroke = new StrokeBuilder(settings.width, settings.color);
    } else {
      this.#newStroke.color = settings.color;
      this.#newStroke.width = settings.width;
    }

    this.#pointThrottler.update(() => {
      this.#newStroke!.addPoint(x, y, pressure);
      this.#currentPreviewPaths = this.#newStroke!.previewPaths.map((p) => ({
        path: p,
        color: settings.color,
      }));
    });
  }

  private async eraserInput(settings: EraserSettings, x: number, y: number) {
    const eraser = new StrokeEraser(settings.width, this.blocks);

    if (settings.deleteStroke) {
      const indeces = await eraser.getHitIndeces({ x, y });

      indeces.forEach((i) => {
        this.#previewPaths.splice(i, 1);
        this.blocks.splice(i, 1);
      });
    } else {
      // TODO: Implement a geometrical eraser at some point
    }
  }

  public finishInput() {
    if (!this.#newStroke) return;
    if (this.#toolSettings.type === "pen") {
      this.blocks.push({ stroke: this.#newStroke.toStroke() } as ContentBlock);

      this.#newStroke.finalizePath().then((v) => {
        this.#previewPaths.push({
          color: (this.#toolSettings as PenSettings).color,
          path: v,
        });
      });
    }

    this.#newStroke.clear();
    this.#newStroke = undefined;
    this.#currentPreviewPaths = [];
  }

  get previewPaths() {
    return this.#previewPaths;
  }
  get currentPreviewPaths() {
    return this.#currentPreviewPaths;
  }
  get tool() {
    return this.#toolSettings;
  }
}
