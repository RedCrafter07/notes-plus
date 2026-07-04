use crate::util::get_builder;

pub fn export_bindings() {
    use specta_typescript::Typescript;
    let builder = get_builder();

    let path = cfg_select! {
        debug_assertions => "../src/lib/tauri/bindings.ts",
        _ => "src/lib/tauri/bindings.ts",
    };

    builder
        .export(Typescript::default(), path)
        .expect("Failed to export typescript bindings");
}
