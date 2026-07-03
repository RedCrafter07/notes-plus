import type { EntryType, File } from "$lib/tauri/bindings";

export type FolderEntry = {
  content: EntryType[];
  name: string;
};

// This class has been generated with the help of Claude Sonnet 4.6
export class FileSystemNavigator {
  #root: FolderEntry;
  #stack: FolderEntry[] = $state([]);
  #allFolders: string[];

  constructor(root: EntryType) {
    if (!isFolder(root)) throw new Error("Root must be a folder");
    this.#root = root.Folder;

    this.#allFolders = getAllFolders(this.#root.content);
  }

  get current() {
    return this.#stack.at(-1) ?? this.#root;
  }

  get path() {
    return this.#stack.map((f) => f.name).join("/");
  }

  enterPath(path: string) {
    this.goToRoot();
    const folders = path.split("/");
    folders.forEach((f) => {
      this.enterFolder(f);
    });
  }

  enterFolder(name: string) {
    const folder = this.current.content
      .filter(isFolder)
      .find((e) => e.Folder.name === name);

    if (folder) this.#stack.push(folder.Folder);
  }

  goBack() {
    this.#stack.pop();
  }

  goToRoot() {
    this.#stack = [];
  }

  get files() {
    return this.current.content.filter(isFile).map((e) => e.File);
  }

  get folders() {
    return this.current.content.filter(isFolder).map((e) => e.Folder);
  }

  get allFolders() {
    return this.#allFolders;
  }

  get isRoot() {
    return this.#stack.length === 0;
  }
}

export function getAllFolders(content: EntryType[], prefix: string = "") {
  const folders: string[] = [];
  const separator = prefix.length > 0 ? "/" : "";

  for (let f of content) {
    if (isFolder(f)) {
      const path = `${prefix}${separator}${f.Folder.name}`;
      folders.push(path);
      folders.push(...getAllFolders(f.Folder.content, path));
    } else continue;
  }

  return folders;
}

export function isFile(entry: EntryType): entry is { File: File } {
  return "File" in entry;
}

export function isFolder(entry: EntryType): entry is { Folder: FolderEntry } {
  return "Folder" in entry;
}
