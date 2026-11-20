import { commands, type FileProblem } from "#lib/tauri/bindings.ts";
import { FileSystemNavigator, isFolder } from "#lib/util/fileSystem.svelte.ts";
import { Store } from "#lib/util/store.svelte.ts";

export const fsStore = new Store<FileSystemNavigator>(
  new FileSystemNavigator({
    Folder: {
      content: [],
      name: "root",
    },
  }),
);

/** Note files in the notebooks folder that could not be read. */
export const problemsStore = new Store<FileProblem[]>([]);

/**
 * Re-indexes the notebooks folder: the browsable tree and the list of files
 * that could not be read. Keeps the browser where it was when possible.
 */
export async function loadNotebooks() {
  const notebooks = await commands.getNotebooks();
  if (!notebooks) return;

  if (isFolder(notebooks.root)) {
    const path = fsStore.store.path;
    const nav = new FileSystemNavigator(notebooks.root);
    if (path && nav.allFolders.includes(path)) nav.enterPath(path);
    fsStore.store = nav;
  }
  problemsStore.store = notebooks.problems;
}
