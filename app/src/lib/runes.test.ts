import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, test } from "vitest";

/*
 * Runes ($state, $derived, ...) only work in .svelte and .svelte.ts files.
 * In a plain .ts file they compile fine and type-check fine, then throw
 * `rune_outside_svelte` at runtime, which is how the PDF import broke.
 * Neither svelte-check nor the build catches it, so this test does.
 */
const RUNE = /\$(state|derived|effect|props|bindable|inspect|host)\s*[.(<]/;
const root = new URL("..", import.meta.url).pathname; // src/

function* tsFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* tsFiles(path);
    else if (/\.ts$/.test(name) && !/\.svelte\.ts$|\.test\.ts$|bindings\.ts$/.test(name)) yield path;
  }
}

test("no runes in plain .ts files", () => {
  const offenders = [...tsFiles(root)]
    .filter((f) => RUNE.test(readFileSync(f, "utf8")))
    .map((f) => relative(root, f));
  expect(offenders).toEqual([]);
});
