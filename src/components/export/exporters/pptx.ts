import { type NativeChart, ENTRY_BY_ID } from "../chart-registry";
import { capturePngBlob } from "../capture";
import { SLIDE_W, type SlidePlan } from "../layout-engine";
import { CELL_PAD, CELL_TITLE_H, FOOTER_H, HEADER_H, MARGIN, type ReportData, type ReportSettings, cellRect, formatReportDate } from "../slide";
import { type ExportTheme, pptColor } from "../themes";
import { saveBlob } from "./download";

/*
 * PowerPoint: one slide per page. Line / bar / doughnut charts become native,
 * editable PowerPoint charts (their data can be edited in PowerPoint); KPI cards
 * and tables are placed as high-resolution images. Text uses Tahoma, which has
 * Thai glyphs on every Windows / Mac Office install, so Thai never shows as boxes.
 */

const THAI_FONT = "Tahoma";
const IN = SLIDE_W / 13.333; // px per inch for the 13.333 × 7.5 in "wide" layout
const inch = (px: number) => px / IN;

async function toDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function logoDataUrl() {
  const res = await fetch("/brand/thai-iod-logo.png");
  return toDataUrl(await res.blob());
}

export interface PptxJob {
  plans: SlidePlan[];
  data: ReportData;
  theme: ExportTheme;
  settings: ReportSettings;
  /** Full-size content slide elements (same order as plans) — used to capture cells that are not native charts */
  slideNodes: HTMLElement[];
  baseName: string;
  onProgress: (done: number, total: number, label: string) => void;
}

export async function exportPptx({ plans, data, theme, settings, slideNodes, baseName, onProgress }: PptxJob) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = settings.title;
  pptx.company = "Thai Institute of Directors";
  pptx.theme = { headFontFace: THAI_FONT, bodyFontFace: THAI_FONT };

  const total = plans.length + (settings.cover ? 1 : 0) + 1;
  let done = 0;
  const pages = plans.length + (settings.cover ? 1 : 0);
  const logo = settings.logo ? await logoDataUrl() : null;
  const dateText = formatReportDate(settings.date);
  const text = (color: string, size: number, bold = false) => ({ fontFace: THAI_FONT, color: pptColor(color), fontSize: size, bold });

  if (settings.cover) {
    onProgress(done++, total, "กำลังสร้างหน้าปก");
    const s = pptx.addSlide();
    s.background = { color: pptColor(theme.accent) };
    if (logo) s.addImage({ data: logo, x: inch(120), y: inch(150), w: inch(120), h: inch(120) });
    s.addText("IOD FINANCE INTELLIGENCE", { x: inch(120), y: inch(318), w: 10, h: 0.4, ...text(theme.onAccent, 14), charSpacing: 4 });
    s.addText(settings.title, { x: inch(120), y: inch(360), w: 11, h: 1, ...text(theme.onAccent, 40, true) });
    s.addShape(pptx.ShapeType.rect, { x: inch(120), y: inch(470), w: inch(96), h: inch(6), fill: { color: pptColor(theme.series[2] ?? theme.onAccent) }, line: { type: "none" } });
    s.addText(dateText, { x: inch(120), y: inch(500), w: 10, h: 0.45, ...text(theme.onAccent, 18) });
    s.addText(settings.filtersText, { x: inch(120), y: inch(545), w: 11, h: 0.4, ...text(theme.onAccent, 14) });
    if (settings.pageNumbers) s.addText(`หน้า 1 / ${pages}`, { x: 11.3, y: 6.9, w: 1.6, h: 0.3, align: "right", ...text(theme.onAccent, 10) });
  }

  for (const [si, plan] of plans.entries()) {
    onProgress(done++, total, `กำลังสร้างสไลด์ที่ ${si + 1} จาก ${plans.length}`);
    const s = pptx.addSlide();
    s.background = { color: pptColor(theme.bg) };
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: inch(8), fill: { color: pptColor(theme.accent) }, line: { type: "none" } });
    const sections = [...new Set(plan.ids.map((id) => ENTRY_BY_ID.get(id)?.section).filter(Boolean))].join(" · ");
    s.addText(sections, { x: inch(MARGIN), y: inch(MARGIN) - 0.05, w: 10.5, h: 0.45, ...text(theme.text, 20, true) });
    s.addText(settings.title, { x: inch(MARGIN), y: inch(MARGIN) + 0.35, w: 10.5, h: 0.3, ...text(theme.muted, 11) });
    if (logo) s.addImage({ data: logo, x: inch(SLIDE_W - MARGIN - HEADER_H), y: inch(MARGIN), w: inch(HEADER_H), h: inch(HEADER_H) });

    for (const cell of plan.cells) {
      const entry = ENTRY_BY_ID.get(cell.id);
      if (!entry) continue;
      const r = cellRect(cell);
      s.addShape(pptx.ShapeType.roundRect, {
        x: inch(r.left),
        y: inch(r.top),
        w: inch(r.width),
        h: inch(r.height),
        rectRadius: 0.12,
        fill: { color: pptColor(theme.surface) },
        line: { color: pptColor(theme.border), width: 0.75 },
      });
      s.addText(entry.title, { x: inch(r.left + CELL_PAD), y: inch(r.top + CELL_PAD) - 0.04, w: inch(r.width - CELL_PAD * 2), h: 0.32, ...text(theme.text, 14, true) });
      if (entry.subtitle) s.addText(entry.subtitle, { x: inch(r.left + CELL_PAD), y: inch(r.top + CELL_PAD) + 0.24, w: inch(r.width - CELL_PAD * 2), h: 0.26, ...text(theme.muted, 10) });

      const area = { x: inch(r.left + CELL_PAD), y: inch(r.top + CELL_PAD + CELL_TITLE_H), w: inch(r.width - CELL_PAD * 2), h: inch(r.height - CELL_PAD * 2 - CELL_TITLE_H) };
      const d = data[entry.data];
      const native = d && entry.native ? entry.native(d as never, theme) : null;
      if (native && native.labels.length) {
        addNativeChart(pptx, s, native, theme, area);
      } else {
        // Not a chart PowerPoint can draw natively (KPI card, table): place a sharp image of the same cell.
        const el = slideNodes[si]?.querySelector<HTMLElement>(`[data-cell="${CSS.escape(cell.id)}"] [data-chart]`);
        if (el) {
          const png = await capturePngBlob(el, theme.surface, el.offsetWidth, el.offsetHeight);
          s.addImage({ data: await toDataUrl(png), ...area });
        }
      }
    }

    const footerY = inch(900 - MARGIN / 2 - FOOTER_H);
    s.addText(`${dateText} · ${settings.filtersText}`, { x: inch(MARGIN), y: footerY, w: 10.5, h: inch(FOOTER_H), ...text(theme.muted, 10) });
    if (settings.pageNumbers) {
      s.addText(`หน้า ${si + 1 + (settings.cover ? 1 : 0)} / ${pages}`, {
        x: inch(SLIDE_W - MARGIN) - 1.6,
        y: footerY,
        w: 1.6,
        h: inch(FOOTER_H),
        align: "right",
        ...text(theme.muted, 10),
      });
    }
  }

  onProgress(done++, total, "กำลังบันทึก PowerPoint");
  const raw = (await pptx.write({ outputType: "blob" })) as Blob;
  const blob = new Blob([raw], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
  saveBlob(blob, `${baseName}.pptx`);
  onProgress(total, total, "เสร็จแล้ว");

}

type Pptx = InstanceType<typeof import("pptxgenjs").default>;
type Slide = ReturnType<Pptx["addSlide"]>;

function addNativeChart(pptx: Pptx, s: Slide, c: NativeChart, theme: ExportTheme, area: { x: number; y: number; w: number; h: number }) {
  const data = c.series.map((sr) => ({ name: sr.name, labels: c.labels, values: sr.values }));
  const colors = c.type === "doughnut" ? theme.series.map(pptColor) : c.series.map((sr, i) => pptColor(sr.color ?? theme.series[i % theme.series.length]));
  const common = {
    ...area,
    chartColors: colors,
    showLegend: c.type === "doughnut" || c.series.length > 1,
    legendPos: c.type === "doughnut" ? ("r" as const) : ("b" as const),
    legendFontFace: THAI_FONT,
    legendFontSize: 10,
    legendColor: pptColor(theme.text),
    catAxisLabelFontFace: THAI_FONT,
    catAxisLabelFontSize: 10,
    catAxisLabelColor: pptColor(theme.muted),
    valAxisLabelFontFace: THAI_FONT,
    valAxisLabelFontSize: 10,
    valAxisLabelColor: pptColor(theme.muted),
    valAxisLabelFormatCode: c.format ?? "#,##0",
    valGridLine: { color: pptColor(theme.grid), size: 0.75 },
    catGridLine: { style: "none" as const },
    plotArea: { fill: { color: pptColor(theme.surface) } },
  };
  if (c.type === "doughnut") {
    s.addChart(pptx.ChartType.doughnut, data, { ...common, holeSize: 55, showPercent: true, dataLabelColor: "FFFFFF", dataLabelFontSize: 10 });
  } else if (c.type === "line") {
    s.addChart(pptx.ChartType.line, data, { ...common, lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 6 });
  } else {
    s.addChart(pptx.ChartType.bar, data, {
      ...common,
      barDir: c.horizontal ? "bar" : "col",
      barGrouping: c.stacked ? "stacked" : "clustered",
      barGapWidthPct: 60,
      // Largest first from the top, as on screen (supported by pptxgenjs, missing from its types).
      catAxisOrientation: (c.horizontal ? "maxMin" : "minMax") as "minMax",
    });
  }
}
