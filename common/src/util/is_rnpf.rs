use std::path::PathBuf;

pub fn is_rnpf(path: &&PathBuf) -> bool {
    path.extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("rnpf"))
}

#[cfg(test)]
mod test {
    use crate::util::is_rnpf;

    #[test]
    fn accepts_rnpf_regardless_of_case() {
        assert!(is_rnpf("note.rnpf"));
        assert!(is_rnpf("NOTE.RNPF"));
        assert!(is_rnpf("/a/b/c.rnpf"));
    }

    #[test]
    fn rejects_everything_else() {
        assert!(!is_rnpf("note.png"));
        assert!(!is_rnpf("note"));
        assert!(!is_rnpf("note.rnpf.bak"));
    }
}
