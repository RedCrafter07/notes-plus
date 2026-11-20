//! File format migrations.
//!
//! Each `.rnpf` archive carries a `version` file. On load, the raw JSON of the
//! `data` entry is upgraded one step at a time until it matches
//! [`CURRENT_VERSION`], and only then deserialized into the typed structs.
//! Working on `serde_json::Value` means old shapes never need to exist as Rust
//! types: a migration only has to know the JSON it rewrites.
//!
//! To add a version: bump `CURRENT_VERSION`, write `vN_to_vN+1`, and add it to
//! the `match` in [`migrate_content`].

use serde_json::{Map, Value, json};

use crate::io::archive::RnpfError;

pub const CURRENT_VERSION: u32 = 4;
/// The oldest version that can still be upgraded.
pub const OLDEST_SUPPORTED_VERSION: u32 = 2;

pub fn parse_version(raw: &str) -> Result<u32, RnpfError> {
    let version: u32 = raw.trim().parse().map_err(|_| RnpfError::InvalidVersion)?;

    if (OLDEST_SUPPORTED_VERSION..=CURRENT_VERSION).contains(&version) {
        Ok(version)
    } else {
        Err(RnpfError::InvalidVersion)
    }
}

/// Upgrades the `data` entry (the note's `Content`) from `from` to the current version.
pub fn migrate_content(mut content: Value, from: u32) -> Result<Value, RnpfError> {
    let mut version = from;

    while version < CURRENT_VERSION {
        content = match version {
            2 => v2_to_v3(content)?,
            3 => v3_to_v4(content)?,
            _ => return Err(RnpfError::InvalidVersion),
        };
        version += 1;
    }

    Ok(content)
}

/// v2 -> v3:
/// - Blocks switch from external tagging (`{"Stroke": {...}}`) to internal
///   tagging (`{"type": "Stroke", ...}`), so TypeScript gets a real union.
/// - Strokes gain `opacity` (1.0 = regular ink).
/// - Pages gain `background_asset` (none).
fn v2_to_v3(mut content: Value) -> Result<Value, RnpfError> {
    let pages = content
        .get_mut("pages")
        .and_then(Value::as_array_mut)
        .ok_or(RnpfError::InvalidFile)?;

    for page in pages {
        let page = page.as_object_mut().ok_or(RnpfError::InvalidFile)?;
        page.entry("background_asset").or_insert(Value::Null);

        let Some(layers) = page.get_mut("layers").and_then(Value::as_array_mut) else {
            continue;
        };

        for layer in layers {
            let Some(blocks) = layer.get_mut("blocks").and_then(Value::as_array_mut) else {
                continue;
            };

            for block in blocks.iter_mut() {
                *block = retag_block(block.take())?;
            }
        }
    }

    Ok(content)
}

/// v3 -> v4: pages gain `regions` (export regions, none yet).
fn v3_to_v4(mut content: Value) -> Result<Value, RnpfError> {
    let pages = content
        .get_mut("pages")
        .and_then(Value::as_array_mut)
        .ok_or(RnpfError::InvalidFile)?;

    for page in pages {
        page.as_object_mut()
            .ok_or(RnpfError::InvalidFile)?
            .entry("regions")
            .or_insert(json!([]));
    }

    Ok(content)
}

fn retag_block(block: Value) -> Result<Value, RnpfError> {
    let Value::Object(outer) = block else {
        return Err(RnpfError::InvalidFile);
    };

    // Externally tagged: exactly one key, the variant name.
    let mut entries = outer.into_iter();
    let (Some((tag, Value::Object(mut inner))), None) = (entries.next(), entries.next()) else {
        return Err(RnpfError::InvalidFile);
    };

    if tag == "Stroke" {
        inner.entry("opacity").or_insert(json!(1.0));
    }

    let mut tagged = Map::with_capacity(inner.len() + 1);
    tagged.insert("type".into(), Value::String(tag));
    tagged.extend(inner);

    Ok(Value::Object(tagged))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::structs::data::{Block, Content};

    #[test]
    fn parses_versions() {
        assert_eq!(parse_version("2").unwrap(), 2);
        assert_eq!(parse_version("3\n").unwrap(), 3);
        assert_eq!(parse_version("4").unwrap(), 4);
        assert!(parse_version("1").is_err());
        assert!(parse_version("99").is_err());
        assert!(parse_version("abc").is_err());
    }

    #[test]
    fn migrates_v2_strokes() {
        let v2 = json!({
            "pages": [{
                "layers": [{
                    "id": "l1",
                    "blocks": [{
                        "Stroke": {
                            "id": "s1",
                            "points": [{ "x": 1.0, "y": 2.0, "pressure": 0.5 }],
                            "color": "#000000",
                            "thickness": 6.0
                        }
                    }],
                    "visible": true,
                    "locked": false,
                    "name": "Layer 1"
                }],
                "width": -1.0,
                "height": -1.0,
                "pattern": null,
                "pattern_scale": 24,
                "background_color": "#ffffff",
                "pattern_color": "#dddddd",
                "name": "Page 1"
            }]
        });

        let migrated = migrate_content(v2, 2).unwrap();
        assert_eq!(migrated["pages"][0]["regions"], json!([]), "v2 goes through v3 -> v4");
        let content: Content = serde_json::from_value(migrated).unwrap();

        let page = &content.pages[0];
        assert!(page.is_infinite(), "old pages stay infinite");
        assert!(page.background_asset.is_none());

        let Block::Stroke(s) = &page.layers[0].blocks[0] else {
            panic!("expected a stroke");
        };
        assert_eq!(s.id, "s1");
        assert_eq!(s.opacity, 1.0);
    }

    #[test]
    fn rejects_malformed_blocks() {
        let bad = json!({ "pages": [{ "layers": [{ "blocks": [{ "A": {}, "B": {} }] }] }] });
        assert!(migrate_content(bad, 2).is_err());
    }

    #[test]
    fn current_version_is_untouched() {
        let v = json!({ "pages": [] });
        assert_eq!(migrate_content(v.clone(), CURRENT_VERSION).unwrap(), v);
    }
}
