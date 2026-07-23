use std::path::PathBuf;

pub fn is_rnpf(path: &&PathBuf) -> bool {
    path.extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("rnpf"))
}
