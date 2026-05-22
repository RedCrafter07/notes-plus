class EditorComponents {
  rightBarOpen = $state(false);
  rightBarOption = $state<"layers" | "pages">("pages");

  toggleRightBar() {
    this.rightBarOpen = !this.rightBarOpen;
  }
}

export const editorComponents = new EditorComponents();
