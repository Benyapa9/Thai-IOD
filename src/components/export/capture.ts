"use client";

import { getFontEmbedCSS, toBlob, toJpeg, toPng } from "html-to-image";
import { SLIDE_H, SLIDE_W } from "./layout-engine";

/*
 * Turns off-screen slide elements into images, in the browser only (nothing
 * leaves the machine). Thai text stays correct because the page's own web font
 * (IBM Plex Sans Thai) is loaded first and embedded into every capture.
 */

/** Pixel ratio for exports: 2 × 1600 × 900 = 3200 × 1800 px per slide. */
export const EXPORT_SCALE = 2;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Wait until every weight of the UI font has loaded, including the Thai glyphs. */
export async function ensureFonts() {
  if (!("fonts" in document)) return;
  const family = getComputedStyle(document.body).fontFamily;
  await Promise.all(["400", "500", "600", "700"].map((w) => document.fonts.load(`${w} 16px ${family}`, "ภาษาไทย สระ ุ ู ิ ี ึ ื ่ ้ ๊ ๋ ABC 123")));
  await document.fonts.ready;
}

/** Charts render with animation off; give the browser two frames' worth of time to lay out and paint. */
export async function settle() {
  await wait(60);
  await wait(60);
}

let fontCss: Promise<string> | null = null;
/** The @font-face CSS (with the font files inlined) is the same for every slide; build it once per export. */
export function fontEmbedCss(node: HTMLElement) {
  fontCss ??= getFontEmbedCSS(node).catch(() => "");
  return fontCss;
}
export function resetFontCache() {
  fontCss = null;
}

function options(node: HTMLElement, background: string, width = SLIDE_W, height = SLIDE_H) {
  return fontEmbedCss(node).then((css) => ({
    pixelRatio: EXPORT_SCALE,
    width,
    height,
    backgroundColor: background,
    fontEmbedCSS: css,
    cacheBust: false,
    // The capture copy must sit at 0,0 even though the source is off-screen.
    style: { position: "relative", left: "0", top: "0", transform: "none", margin: "0" },
  }));
}

export async function capturePng(node: HTMLElement, background: string) {
  return toPng(node, await options(node, background));
}

export async function captureJpeg(node: HTMLElement, background: string, quality = 0.95) {
  return toJpeg(node, { ...(await options(node, background)), quality });
}

export async function capturePngBlob(node: HTMLElement, background: string, width?: number, height?: number) {
  const blob = await toBlob(node, await options(node, background, width, height));
  if (!blob) throw new Error("สร้างรูปภาพไม่สำเร็จ");
  return blob;
}

export function dataUrlToBlob(dataUrl: string) {
  const [head, body] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? "application/octet-stream";
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
