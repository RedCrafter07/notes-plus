import { LayerManager } from "./LayerManager.svelte";
import type { Page as PageData } from "$lib/types/bindings/Page";

export class Page {
  public static readonly PAGE_SIZES = {
    A4: { width: 595.28, height: 841.89 }, // 210mm x 297mm
    Letter: { width: 612, height: 792 }, // 8.5" x 11"
    Legal: { width: 612, height: 1008 }, // 8.5" x 14"
    A3: { width: 841.89, height: 1190.55 }, // 297mm x 420mm
    A5: { width: 419.53, height: 595.28 }, // 148mm x 210mm
  } as const;

  layerManager: LayerManager = $state(new LayerManager());

  backgroundColor = $state("#ffffff");
  pageSize: { width: number; height: number } = $state(Page.PAGE_SIZES.A4);
  pageType: "infinite" | "fixed" = $state("fixed");

  constructor(pageData?: PageData) {
    if (pageData) {
      // TODO: Utilize style/styleColor
      const { backgroundColor, layers, pageSize, pageType } = pageData;
      this.layerManager = new LayerManager(layers);

      this.backgroundColor = backgroundColor;
      const [width, height] = pageSize;
      this.pageSize = { width, height };
      this.pageType = pageType === "Infinite" ? "infinite" : "fixed";
    } else {
      this.layerManager = new LayerManager();
    }
  }

  public setPageSize(pageSize: { width: number; height: number }) {
    this.pageSize = pageSize;
  }

  public setPredefinedPageSize(preset: keyof typeof Page.PAGE_SIZES) {
    const pageSize = Page.PAGE_SIZES[preset];
    this.pageSize = pageSize;
  }

  public export(): PageData {
    const { width, height } = this.pageSize;
    const data: PageData = {
      layers: this.layerManager.export(),
      backgroundColor: this.backgroundColor,
      pageSize: [width, height],
      pageType: this.pageType === "infinite" ? "Infinite" : "Fixed",
      style: "Dots",
      styleColor: "#cccccc",
    };

    return data;
  }

  public get allSVGs() {
    return this.layerManager.svgLayers;
  }
}
