export interface Popup {
  id: string;
  type: "success" | "destructive" | "info" | "warning";
  title?: string;
  message: string;
}

class PopupManager {
  #queue = $state<Popup[]>([]);
  #timeout?: number;

  add(popup: Omit<Popup, "id">) {
    this.#queue.push({
      ...popup,
      id: crypto.randomUUID(),
    });
    this.#timeout = setTimeout(() => {
      this.#queue.shift();
    }, 5000);
  }

  remove(index: number = 0) {
    clearTimeout(this.#timeout);
    this.#queue.splice(index, 1);
  }

  get currentPopup() {
    return this.#queue[0];
  }
}

export const popupManager = new PopupManager();
