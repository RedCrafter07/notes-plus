use common::structs::{file_meta::FileMeta, user_prefs::UserPrefs};
use ts_rs::TS;

fn main() {
    let result = FileMeta::export_all_to("../app/src/lib/types/bindings/");
    let result_2 = UserPrefs::export_all_to("../app/src/lib/types/bindings/");

    assert!(result.is_ok());
    assert!(result_2.is_ok());

    println!("✅ TypeScript bindings exported successfully!");
}
