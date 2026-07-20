use common::io::{archive::RnpfError, index::IndexError};
use thiserror::Error;

use crate::util::{ArgsError, display_error};

pub trait ResultExt<T> {
    // fn or_display(self) -> Option<T>;

    fn unwrap_or_display(self, fallback: T) -> T;

    // fn unwrap_or_display_default(self) -> T
    // where
    //     T: Default;
}

#[derive(Debug, Error)]
pub enum AppError {
    #[error(transparent)]
    Args(#[from] ArgsError),
    #[error(transparent)]
    Index(#[from] IndexError),
    #[error(transparent)]
    Rnpf(#[from] RnpfError),
    #[error(transparent)]
    Tauri(#[from] tauri::Error),
}

pub type Result<T> = std::result::Result<T, AppError>;

impl<T> ResultExt<T> for Result<T> {
    // fn or_display(self) -> Option<T> {
    //     self.map_err(display_error).ok()
    // }
    fn unwrap_or_display(self, fallback: T) -> T {
        self.unwrap_or_else(|e| {
            display_error(e);
            fallback
        })
    }
    // fn unwrap_or_display_default(self) -> T
    // where
    //     T: Default,
    // {
    //     Self::unwrap_or_display(self, T::default())
    // }
}
