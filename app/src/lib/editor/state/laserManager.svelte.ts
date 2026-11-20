import type { Point } from "#lib/tauri/bindings.ts";
import type { LaserStroke } from "#lib/present/protocol.ts";

/** How long a laser stroke stays fully visible after the pen lifts. */
const HOLD_MS = 600;
/** How long it then takes to fade out. */
const FADE_MS = 700;

/*
 * Laser pointer: temporary ink for pointing at things while presenting.
 * Strokes are never added to the note or to history; they fade out shortly
 * after the pen lifts. Shown in the editor and sent to the audience window.
 */
class LaserManager {
  strokes = $state<LaserStroke[]>([]);
  #ended = new Map<string, number>();
  #current?: string;
  #frame = 0;

  begin(p: Point) {
    const id = crypto.randomUUID();
    this.#current = id;
    this.strokes = [...this.strokes, { id, points: [p], opacity: 1 }];
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
    this.#ended.set(this.#current, performance.now());
    this.#current = undefined;
    this.#tick();
  }

  /** Fades ended strokes, one animation frame at a time, until none are left. */
  #tick = () => {
    cancelAnimationFrame(this.#frame);
    const now = performance.now();
    let pending = false;

    this.strokes = this.strokes.flatMap((s) => {
      const ended = this.#ended.get(s.id);
      if (ended === undefined) return [s];
      const age = now - ended - HOLD_MS;
      if (age >= FADE_MS) {
        this.#ended.delete(s.id);
        return [];
      }
      pending = true;
      return [{ ...s, opacity: age <= 0 ? 1 : 1 - age / FADE_MS }];
    });

    if (pending) this.#frame = requestAnimationFrame(this.#tick);
  };
}

export const laserManager = new LaserManager();
