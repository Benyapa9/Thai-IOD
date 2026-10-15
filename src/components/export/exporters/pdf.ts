import { SLIDE_H, SLIDE_W } from "../layout-engine";
import { captureJpeg } from "../capture";
import { type ExportJob, saveBlob } from "./download";

/**
 * One slide per landscape 16:9 page. Pages are high-resolution images, so Thai
 * text looks exactly as on screen (jsPDF's own text needs a Thai font file and
 * still breaks vowel placement).
 */
export async function exportPdf({ slides, background, baseName, onProgress }: ExportJob) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [SLIDE_W, SLIDE_H], hotfixes: ["px_scaling"], compress: true });
  for (const [i, node] of slides.entries()) {
    onProgress(i, slides.length + 1, `กำลังสร้างหน้าที่ ${i + 1} จาก ${slides.length}`);
    const img = await captureJpeg(node, background, 0.92);
    if (i > 0) pdf.addPage([SLIDE_W, SLIDE_H], "landscape");
    pdf.addImage(img, "JPEG", 0, 0, SLIDE_W, SLIDE_H, undefined, "FAST");
  }
  onProgress(slides.length, slides.length + 1, "กำลังบันทึก PDF");
  pdf.setProperties({ title: baseName, creator: "IOD Finance Intelligence" });
  saveBlob(pdf.output("blob"), `${baseName}.pdf`);
  onProgress(slides.length + 1, slides.length + 1, "เสร็จแล้ว");
}
