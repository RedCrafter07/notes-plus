use specta_typescript::BigIntExportBehavior;

use crate::util::get_builder;

pub fn export_bindings() {
    use specta_typescript::Typescript;
    let builder = get_builder();

    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../src/lib/tauri/bindings.ts");

    builder
        .export(
            Typescript::default().bigint(BigIntExportBehavior::String),
            path,
        )
        .expect("Failed to export typescript bindings");
}

#[cfg(test)]
mod tests {
    #[test]
    #[ignore = "run explicitly to (re)generate the TypeScript bindings"]
    fn export_typescript_bindings() {
        super::export_bindings();
        println!("Wrote bindings!");
    }
}
