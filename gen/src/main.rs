use common::structs::file_meta::FileMeta;
use ts_rs::TS;

fn main() {
    let result = FileMeta::export_all_to("../app/src/lib/types/bindings/");

    assert!(result.is_ok());

    println!("✅ TypeScript bindings exported successfully!");
}
