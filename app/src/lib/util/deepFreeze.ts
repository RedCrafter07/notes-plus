// This code has been written by Claude Opus 4.8 (High effort)
export function deepFreeze<T>(o: T): T {
  Object.values(o as object).forEach(
    (v) => v && typeof v === "object" && !Object.isFrozen(v) && deepFreeze(v),
  );
  return Object.freeze(o);
}
