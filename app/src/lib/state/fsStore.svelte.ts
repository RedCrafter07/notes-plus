import { FileSystemNavigator } from "$lib/util/fileSystem.svelte";
import { Store } from "$lib/util/store.svelte";

export const fsStore = new Store<FileSystemNavigator>(
  new FileSystemNavigator({
    Folder: {
      content: [],
      name: "root",
    },
  }),
);
