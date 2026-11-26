//! Writes `app/src/lib/tauri/bindings.ts` from the Rust commands and types.
//!
//! An example rather than a test so it can be built with the release
//! profile and the same features as `tauri build`: the two then share every
//! compiled dependency, and a production build no longer compiles the whole
//! dependency tree twice (once for `cargo test`, once for the app). Run it
//! with `bun run bindings` (see `app/scripts/bindings.ts`); dev builds also
//! export on every start.

fn main() {
    rednotes_plus_lib::util::export_bindings::export_bindings();
    println!("Wrote src/lib/tauri/bindings.ts");
}
