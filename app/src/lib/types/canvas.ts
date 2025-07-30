export type SimplePoint = Record<"x" | "y", number>;
export type Point = Record<"x" | "y" | "pressure", number>;
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
