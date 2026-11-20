import { popupManager, type Popup } from "#lib/state/popupManager.svelte.ts";
import type { DialogData } from "#lib/tauri/bindings.ts";

export function handleDialog(data: DialogData) {
  let dialogType: Popup["type"];

  switch (data.dialog_type) {
    case "Error":
      dialogType = "destructive";
      break;
    case "Warning":
      dialogType = "warning";
      break;
    case "Info":
      dialogType = "info";
      break;
    case "Success":
      dialogType = "success";
      break;
  }

  popupManager.add({
    type: dialogType,
    message: data.message,
    title: data.title ?? undefined,
  });
}
