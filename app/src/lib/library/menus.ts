import {
  IconCopy,
  IconCursorText,
  IconExternalLink,
  IconFolderOpen,
  IconFolderSymlink,
  IconTrash,
} from "@tabler/icons-svelte";
import type { MenuItem } from "#lib/state/contextMenu.svelte.ts";
import type { File } from "#lib/tauri/bindings.ts";
import {
  duplicateNotebook,
  libraryDialog,
  openNotebook,
  revealNotebook,
  trashNotebook,
} from "./actions.svelte.ts";

/** The context menu of a notebook (right-click, long-press, or ⋯). */
export function notebookMenu(file: File) {
  const items: MenuItem[] = [
    { label: "Open", icon: IconExternalLink, onSelect: () => openNotebook(file) },
    {
      label: "Rename…",
      icon: IconCursorText,
      onSelect: () => {
        libraryDialog.current = { kind: "rename", file };
      },
    },
    {
      label: "Move to folder…",
      icon: IconFolderSymlink,
      onSelect: () => {
        libraryDialog.current = { kind: "move", file };
      },
    },
    { label: "Duplicate", icon: IconCopy, onSelect: () => duplicateNotebook(file) },
    {
      label: "Show in file manager",
      icon: IconFolderOpen,
      onSelect: () => revealNotebook(file),
      separator: true,
    },
    {
      label: "Move to trash",
      icon: IconTrash,
      destructive: true,
      separator: true,
      onSelect: () => trashNotebook(file),
    },
  ];
  return { title: file.title, items };
}

/** The context menu of a folder in the file browser. */
export function folderMenu(path: string, open: () => void) {
  const items: MenuItem[] = [
    { label: "Open", icon: IconFolderOpen, onSelect: open },
    {
      label: "Rename…",
      icon: IconCursorText,
      onSelect: () => {
        libraryDialog.current = { kind: "renameFolder", folder: path };
      },
    },
  ];
  return { title: path, items };
}
