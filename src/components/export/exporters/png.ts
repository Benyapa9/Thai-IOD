import { capturePngBlob } from "../capture";
import { type ExportJob, saveBlob, zipFiles } from "./download";

/** One high-resolution PNG per slide; several slides are zipped. */
export async function exportPng({ slides, background, baseName, onProgress }: ExportJob) {
  const files: { name: string; blob: Blob }[] = [];
  for (const [i, node] of slides.entries()) {
    onProgress(i, slides.length + 1, `กำลังสร้างรูปสไลด์ที่ ${i + 1} จาก ${slides.length}`);
    files.push({ name: `${baseName}_${String(i + 1).padStart(2, "0")}.png`, blob: await capturePngBlob(node, background) });
  }
  onProgress(slides.length, slides.length + 1, "กำลังรวมไฟล์");
  if (files.length === 1) saveBlob(files[0].blob, `${baseName}.png`);
  else saveBlob(await zipFiles(files), `${baseName}_png.zip`);
  onProgress(slides.length + 1, slides.length + 1, "เสร็จแล้ว");
}
