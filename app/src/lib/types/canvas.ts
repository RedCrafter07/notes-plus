export type Mode = "draw" | "erase" | "pan";
export type Data = any;

export type SimplePoint = Record<"x" | "y", number>;
export type Point = Record<"x" | "y" | "pressure", number>;
