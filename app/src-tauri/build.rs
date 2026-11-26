fn main() {
    tauri_build::build();

    delay_load_comctl32();
}

/// Delay-load `comctl32.dll` on Windows so that `cargo test` works.
///
/// The dialog plugin pulls in `rfd` with the `common-controls-v6` feature, so
/// everything linked against this crate imports comctl32 v6 symbols
/// (`TaskDialogIndirect`, `SetWindowSubclass`). Those live in the side-by-side
/// v6 assembly, which the loader only picks up when the executable carries an
/// application manifest asking for it.
///
/// `tauri_build::build()` puts such a manifest in the app binary, but it has no
/// say over the executables `cargo test` links, and Cargo has no way to add one
/// to the unit-test harness of a library. Without it the loader binds
/// comctl32.dll to the legacy 5.82 copy in System32, which exports neither
/// symbol, so every test binary in this crate dies with
/// STATUS_ENTRYPOINT_NOT_FOUND (0xc0000139) before `main` runs -- including the
/// `export_typescript_bindings` test that `bun run prebuild` uses to generate
/// `src/lib/tauri/bindings.ts`, which is what makes `tauri build` fail on
/// Windows.
///
/// Delaying the import moves the lookup from load time to the first actual
/// call. The app binary still has its manifest, so its dialogs resolve to v6 as
/// before; test binaries never call into comctl32 and now start.
fn delay_load_comctl32() {
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let target_env = std::env::var("CARGO_CFG_TARGET_ENV").unwrap_or_default();

    // `/DELAYLOAD` and the helper it needs are link.exe specifics.
    if target_os != "windows" || target_env != "msvc" {
        return;
    }

    println!("cargo:rustc-link-arg=/DELAYLOAD:comctl32.dll");
    println!("cargo:rustc-link-arg=delayimp.lib");
}
