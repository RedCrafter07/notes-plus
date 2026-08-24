import { handleSave } from "./handleSave.svelte";

export function useShortcuts() {
  $effect(() => {
    const event = async (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;

      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        await handleSave(e.shiftKey);
      }
    };
    document.addEventListener("keydown", event);

    return () => {
      document.removeEventListener("keydown", event);
    };
  });
}
