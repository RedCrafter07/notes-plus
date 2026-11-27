use serde::{Deserialize, Serialize};
use specta::Type;

/// Which edge of the editor the toolbar is docked to.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Type, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ToolbarDock {
    #[default]
    Top,
    Bottom,
    Left,
    Right,
}

/// How strongly pen pressure changes the pen's stroke width.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Type, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PenPressure {
    /// Even width, whatever the pressure.
    Off,
    #[default]
    Light,
    Strong,
}

/// The tools a pen preset can switch to.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Type, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PresetTool {
    Pen,
    Highlighter,
}

/// A saved pen: tool, colour and width, switched to with one tap.
#[derive(Clone, Debug, PartialEq, Type, Serialize, Deserialize)]
pub struct PenPreset {
    pub tool: PresetTool,
    pub color: String,
    pub size: f32,
}

#[derive(Clone, Debug, Type, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    pub sidebar_collapsed: bool,
    pub use_last_page_settings: bool,
    /// Swatches for the pen and text tools.
    pub colors: Vec<String>,
    /// Swatches for the highlighter, which has its own set (like OneNote).
    pub highlighter_colors: Vec<String>,
    pub shift_swaps_scroll_axes: bool,
    pub disable_tool_switch: bool,
    /// Save open notes automatically a moment after each change.
    pub autosave: bool,
    /// Use the operating system's title bar instead of merging the window
    /// controls into the tab bar (e.g. for tiling window managers).
    pub system_title_bar: bool,
    /// Where the editor toolbar sits; left-handed writers often prefer left.
    pub toolbar_dock: ToolbarDock,
    /// Presenter mode on a second display: full screen (true), or a normal
    /// window on that display (false). Without a second display the audience
    /// view is always a window, opened behind the editor.
    pub present_fullscreen: bool,
    /// Pressure response of the pen (not the highlighter, which stays even).
    pub pen_pressure: PenPressure,
    /// With a lasso selection, dragging anywhere moves it (a tap outside
    /// still deselects) and two fingers pinch/twist it instead of the view.
    pub transform_anywhere: bool,
    /// Saved pens shown in the toolbar, in order.
    pub pen_presets: Vec<PenPreset>,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            sidebar_collapsed: false,
            use_last_page_settings: true,
            colors: vec!["#000000".into(), "#f22e2e".into(), "#55ea41".into()],
            highlighter_colors: ["#ffe600", "#7ae25b", "#4cd6ff", "#ff6fb5", "#ff9f40"]
                .map(String::from)
                .to_vec(),
            shift_swaps_scroll_axes: true,
            disable_tool_switch: false,
            autosave: true,
            system_title_bar: false,
            toolbar_dock: ToolbarDock::Top,
            present_fullscreen: true,
            pen_pressure: PenPressure::Light,
            transform_anywhere: false,
            pen_presets: Vec::new(),
        }
    }
}
