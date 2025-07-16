use common::structs::file_data::Note;
use ts_rs::TS;

fn main() {
    let result = Note::export_all_to("../app/src/lib/types/bindings/");

    assert!(result.is_ok());

    println!("✅ TypeScript bindings exported successfully!");
}
