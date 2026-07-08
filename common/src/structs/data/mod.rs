mod content;
mod meta;
mod note;
mod state;

pub use content::*;
pub use meta::*;
pub use note::*;
pub use state::*;

pub trait FromToBin: serde::Serialize + serde::de::DeserializeOwned {
    fn to_bytes(&self) -> Result<Vec<u8>, serde_json::Error> {
        serde_json::to_vec(&self)
    }

    fn from_bytes(input: &[u8]) -> Result<Self, serde_json::Error> {
        serde_json::from_slice(input)
    }
}

impl<T: serde::Serialize + serde::de::DeserializeOwned> FromToBin for T {}
