/*
 * Generates src/lib/tauri/bindings.ts (kept out of git) by running the
 * `export_bindings` example.
 *
 *   bun run bindings        release profile, as `tauri build` compiles it
 *   bun run bindings dev    debug profile, for checks (CI) and quick runs
 *
 * The release variant runs before every production build (`prebuild`).
 * It uses the release profile and the `tauri/custom-protocol` feature that
 * the Tauri CLI passes, so `tauri build` afterwards reuses every compiled
 * dependency instead of building the tree a second time in another profile.
 *
 * A release build embeds the frontend at compile time and fails if
 * `build/` does not exist yet, which it does not before `vite build`; a
 * placeholder is created then, and `vite build` replaces it.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const dev = process.argv[2] === "dev";

if (!dev && !existsSync(join(root, "build"))) {
  mkdirSync(join(root, "build"));
  writeFileSync(join(root, "build", "index.html"), "<!-- placeholder until vite build -->\n");
}

const args = ["run", "-p", "rednotes-plus", "--example", "export_bindings"];
if (!dev) args.push("--release", "--features", "tauri/custom-protocol");

const run = Bun.spawnSync(["cargo", ...args], { cwd: root, stdio: ["inherit", "inherit", "inherit"] });
process.exit(run.exitCode ?? 1);
