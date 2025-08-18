use common::structs::user_prefs::UserPrefs;

#[derive(Default)]
pub struct AppState {
    pub user_prefs: UserPrefs,
    pub file_to_open: Option<String>,
}

impl AppState {
    pub fn new() -> Self {
        let prefs_path = dirs::config_dir()
            .unwrap()
            .join("rednotes-plus")
            .join("prefs");

        if let Some(path) = prefs_path.to_str() {
            let user_prefs = UserPrefs::from_file_or_default(path);

            let args: Vec<String> = std::env::args().skip(1).collect();

            let file_path = if !args.is_empty() {
                Some(args[0].clone())
            } else {
                None
            };

            return AppState {
                user_prefs,
                file_to_open: file_path,
            };
        };

        AppState::default()
    }
}
