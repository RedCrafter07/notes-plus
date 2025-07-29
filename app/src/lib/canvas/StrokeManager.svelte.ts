import type { Point, Stroke } from "$lib/types/canvas";
import { InputThrottler } from "./InputThrottler";
import { StrokeBuilder } from "./StrokeBuilder.svelte";

export interface PenSettings {
  type: "pen";
  width: number;
  color: string;
}

export interface EraserSettings {
  type: "eraser";
  width: number;
  deleteStroke: boolean;
}

export type ToolSettings = PenSettings | EraserSettings;

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

export class StrokeManager {
  strokes = $state<Stroke[]>([]);

  #toolSettings: ToolSettings = $state({
    type: "pen",
    color: "#ffffff",
    width: 5,
  });

  #inputLocked: boolean = true;
  #newStroke?: StrokeBuilder;

  #currentPreviewPaths: string[] = $state([]);
  #previewPaths: string[] = $state([]);
  #allPoints: Point[] = $state([]);

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
        {
          if (!this.#newStroke) {
            this.#newStroke = new StrokeBuilder(
              currentTool.width,
              currentTool.color,
            );
          } else {
            this.#newStroke.color = currentTool.color;
            this.#newStroke.width = currentTool.width;
          }

          this.#pointThrottler.update(() => {
            this.#newStroke!.addPoint(x, y, pressure);
            this.#currentPreviewPaths = this.#newStroke!.previewPaths;
          });
        }
        break;
    }
  }

  public finishInput() {
    if (!this.#newStroke) return;
    if (this.#toolSettings.type !== "pen") return;

    this.strokes.push(this.#newStroke.toStroke());
    this.#allPoints.push(...this.#newStroke.points);

    this.#newStroke.finalizePath().then((v) => {
      this.#previewPaths.push({
        color: (this.#toolSettings as PenSettings).color,
        path: v,
      });
    });

    this.#newStroke.clear();
    this.#newStroke = undefined;
    this.#currentPreviewPaths = [];
  }

  get allPoints() {
    return this.#allPoints;
  }
  get previewPaths() {
    return this.#previewPaths;
  }
  get currentPreviewPaths() {
    return this.#currentPreviewPaths;
  }
}
