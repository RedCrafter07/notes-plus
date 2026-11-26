import { describe, expect, it, vi } from "vitest";
import { listenAll } from "./listeners";

describe("listenAll", () => {
  it("removes listeners that resolved before stop", async () => {
    const off = vi.fn();
    const l = listenAll(Promise.resolve(off));
    await l.ready;
    l.stop();
    expect(off).toHaveBeenCalledOnce();
  });

  it("removes a listener that resolves after stop, without throwing", async () => {
    const off = vi.fn();
    let resolve!: (f: () => void) => void;
    const l = listenAll(new Promise<() => void>((r) => (resolve = r)));
    expect(() => l.stop()).not.toThrow();
    resolve(off);
    await l.ready;
    expect(off).toHaveBeenCalledOnce();
  });
});
