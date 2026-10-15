/** Save a Blob as a file in the browser (no upload anywhere). */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Several files → one ZIP. */
export async function zipFiles(files: { name: string; blob: Blob }[]) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.blob);
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

/** report_2026-10-15 (or with a suffix) */
export function reportName(date: string) {
  return `report_${date}`;
}

export interface ExportJob {
  /** Full-size slide elements, in order (cover first if any) */
  slides: HTMLElement[];
  background: string;
  baseName: string;
  onProgress: (done: number, total: number, label: string) => void;
}
