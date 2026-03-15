class OverlayManager {
  #open = $state<string>();

  get open() {
    return this.#open;
  }

  setOpen(modal: string) {
    this.#open = modal;
  }
  close() {
    this.#open = undefined;
  }
}

export const overlayManager = new OverlayManager();
