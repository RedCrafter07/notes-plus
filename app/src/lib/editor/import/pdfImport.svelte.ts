import { popupManager } from "#lib/state/popupManager.svelte.ts";
import { openPdf, type PdfSource } from "./pdf.svelte";

/** The PDF import dialog: open while a source is loaded. */
class PdfImport {
  source = $state<PdfSource>();
  loading = $state(false);

  async start(file: File) {
    if (this.loading) return;
    await this.close();
    this.loading = true;
    try {
      this.source = await openPdf(file);
    } catch (e) {
      console.error(e);
      popupManager.add({
        type: "destructive",
        message: `"${file.name}" could not be opened as a PDF.`,
      });
    } finally {
      this.loading = false;
    }
  }

  async close() {
    const s = this.source;
    this.source = undefined;
    await s?.close();
  }
}

export const pdfImport = new PdfImport();

export const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
