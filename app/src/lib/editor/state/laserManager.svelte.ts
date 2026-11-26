import type { Point } from "#lib/tauri/bindings.ts";
import type { LaserStroke } from "#lib/present/protocol.ts";

/** How long a laser stroke stays fully visible after the pen lifts. */
const HOLD_MS = 600;
/** How long it then takes to fade out. */
const FADE_MS = 700;

/*
 * Laser pointer: temporary ink for pointing at things while presenting.
 * Strokes are never added to the note or to history. The trail is one
 * gesture: strokes stay while you keep pointing (circle something, then
 * underline it) and fade out together once the pen has been up a moment.
 * A new stroke brings back strokes that were already fading. Shown in the
 * editor and sent to the audience window.
 */
class LaserManager {
  strokes = $state<LaserStroke[]>([]);
  /** When the last stroke ended; the whole trail fades from then. */
  #lastEnd?: number;
  #current?: string;
  #frame = 0;

  begin(p: Point) {
    cancelAnimationFrame(this.#frame);
    const id = crypto.randomUUID();
    this.#current = id;
    this.#lastEnd = undefined;
    this.strokes = [
      ...this.strokes.map((s) => (s.opacity === 1 ? s : { ...s, opacity: 1 })),
      { id, points: [p], opacity: 1 },
    ];
  }

  add(p: Point) {
    const id = this.#current;
    if (!id) return;
    this.strokes = this.strokes.map((s) =>
      s.id === id ? { ...s, points: [...s.points, p] } : s,
    );
  }

  end() {
    if (!this.#current) return;
    this.#lastEnd = performance.now();
    this.#current = undefined;
    this.#tick();
  }

  /** Fades the trail, one animation frame at a time, until it is gone. */
  #tick = () => {
    cancelAnimationFrame(this.#frame);
    if (this.#current || this.#lastEnd === undefined) return;

    const age = performance.now() - this.#lastEnd - HOLD_MS;
    if (age >= FADE_MS) {
      this.strokes = [];
      this.#lastEnd = undefined;
      return;
    }
    if (age > 0) {
      const opacity = 1 - age / FADE_MS;
      this.strokes = this.strokes.map((s) => ({ ...s, opacity }));
    }
    this.#frame = requestAnimationFrame(this.#tick);
  };
}

export const laserManager = new LaserManager();
