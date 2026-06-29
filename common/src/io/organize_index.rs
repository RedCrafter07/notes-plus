use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Clone, Debug, Deserialize, Serialize, Type)]
pub enum EntryType {
    File(super::index::File),
    Folder {
        content: Vec<EntryType>,
        name: String,
    },
}

impl EntryType {
    pub fn create_folder(name: String) -> Self {
        EntryType::Folder {
            content: vec![],
            name,
        }
    }

    pub fn from_index(files: Vec<super::index::File>) -> Self {
        let mut root_content: Vec<EntryType> = vec![];

        for file in files {
            if let Some(folder) = file.folder.clone() {
                let segments: Vec<&str> = folder.split("/").collect();
                Self::insert_at(&mut root_content, &segments, file);
            } else {
                root_content.push(Self::File(file))
            }
        }

        Self::Folder {
            content: root_content,
            name: "root".into(),
        }
    }

    // This part has been made with some help of Claude Sonnet 4.6
    fn insert_at(content: &mut Vec<EntryType>, path: &[&str], file: super::index::File) {
        if path.is_empty() {
            content.push(EntryType::File(file));
            return;
        }

        let segment = path[0];

        let folder = content
            .iter_mut()
            .find(|e| matches!(e, EntryType::Folder { name, .. } if name == segment));

        if let Some(EntryType::Folder { content: inner, .. }) = folder {
            Self::insert_at(inner, &path[1..], file);
        } else {
            let mut new_folder = Self::create_folder(segment.to_string());
            if let EntryType::Folder { content: inner, .. } = &mut new_folder {
                Self::insert_at(inner, &path[1..], file);
            }
            content.push(new_folder);
        }
    }
}
