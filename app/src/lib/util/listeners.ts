/**
 * One cleanup for listeners registered asynchronously (Tauri's `listen` and
 * `onCloseRequested` return a promise of their unlisten function).
 *
 * Safe to call before they have resolved: a listener that arrives after
 * cleanup is removed at once. Calling a not-yet-assigned unlisten used to
 * throw on hot reload and blank the window; listeners registered in an
 * `async onMount` were never removed at all.
 */
export function listenAll(...pending: Promise<() => void>[]): {
  ready: Promise<void>;
  stop: () => void;
} {
  let stopped = false;
  const unlisten: (() => void)[] = [];
  const ready = Promise.all(
    pending.map((p) =>
      p.then((f) => {
        if (stopped) f();
        else unlisten.push(f);
      }),
    ),
  ).then(() => {});

  return {
    ready,
    stop() {
      stopped = true;
      for (const f of unlisten.splice(0)) f();
    },
  };
}
