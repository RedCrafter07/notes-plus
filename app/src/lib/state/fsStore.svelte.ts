import { FileSystemNavigator } from "#lib/util/fileSystem.svelte.ts";
import { Store } from "#lib/util/store.svelte.ts";

export const fsStore = new Store<FileSystemNavigator>(
  new FileSystemNavigator({
    Folder: {
      content: [],
      name: "root",
    },
  }),
);
