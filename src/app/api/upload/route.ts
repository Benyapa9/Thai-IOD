import { NextResponse } from "next/server";
import { uploadBlob } from "@/lib/azure-blob";
import { SLOT_BY_KEY, detectSlot, slotOfUpload } from "@/lib/upload-slots";
import { HttpError, route, requireFeature } from "@/server/http";
import { describeBatch, ingestFile } from "@/server/ingest";
import { parseSlotFile } from "@/server/ingest/parsers";
import { notifyAllAlertsSafely } from "@/server/notifications";
import { type ParseResult, parseFinancialFile } from "@/server/parse-upload";
import { getRepo } from "@/server/repository";
import type { DatasetBatch } from "@/types/dataset";
import { DERIVED_UPLOAD_ID } from "@/server/repository/types";

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED = [".xlsx", ".xls", ".csv"];

export const GET = route(async () => {
  await requireFeature("upload.history");
  const repo = await getRepo();
  const [uploads, users] = await Promise.all([repo.uploads.list(), repo.users.list()]);
  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  return NextResponse.json({
    uploads: uploads
      .filter((u) => u.id !== DERIVED_UPLOAD_ID)
      .map((u) => ({ ...u, slot: slotOfUpload(u)?.key ?? null, uploaderName: nameOf.get(u.uploadedBy) ?? u.uploadedBy })),
  });
});

/**
 * How a file will be handled:
 * - dataset:   a recognised source file (GL, budget, masters, activities) → its table is replaced
 * - financial: standard period/category/amount layout → FinancialRecord
 * - reject:    not recognised / not readable
 */
type Mode = "dataset" | "financial" | "reject";

function safeFinancial(buffer: Buffer, filename: string): ParseResult {
  try {
    return parseFinancialFile(buffer, filename);
  } catch {
    return { records: [], errors: [{ row: 0, message: "อ่านไฟล์ไม่ได้ หรือไฟล์เสียหาย" }], totalRows: 0 };
  }
}

/**
 * Checks against data already in the system (MOM U5/U6): what will be added vs
 * refreshed, and anything that will not link up (e.g. budget codes missing from BG_YEAR).
 */
async function checkBatch(batch: DatasetBatch): Promise<string[]> {
  const snap = await (await getRepo()).dataset.snapshot();
  const out: string[] = [];
  switch (batch.kind) {
    case "gl": {
      const existing = batch.periods.filter((p) => snap.gl.some((t) => t.period === p));
      if (existing.length) out.push(`มีข้อมูลเดือน ${existing.join(", ")} อยู่แล้ว — จะแทนที่เฉพาะเดือนนี้ด้วยไฟล์ใหม่ (เดือนอื่นไม่เปลี่ยน)`);
      else out.push(`เป็นข้อมูลเดือนใหม่ ${batch.periods.join(", ")} — จะเพิ่มต่อท้ายข้อมูลเดิม`);
      const codes = new Set(snap.budgetLines.map((l) => l.budgetCode));
      if (codes.size) {
        const missing = batch.rows.filter((t) => t.budgetCode && !codes.has(t.budgetCode));
        const noCode = batch.rows.filter((t) => !t.budgetCode).length;
        if (missing.length)
          out.push(`⚠ ${missing.length} รายการมีรหัสงบประมาณที่ไม่พบในไฟล์งบประมาณ (BG_YEAR) จะไม่ถูกจัดเข้าหน่วยงาน/บรรทัด P&L — ควรอัปโหลด BG_YEAR ล่าสุดก่อน`);
        if (noCode) out.push(`⚠ ${noCode} รายการไม่มีรหัสงบประมาณ`);
      } else {
        out.push("⚠ ยังไม่มีไฟล์งบประมาณ (BG_YEAR) — ควรอัปโหลดก่อนเพื่อให้จับคู่หน่วยงานได้");
      }
      break;
    }
    case "budgetLines": {
      const codes = new Set(snap.budgetLines.map((l) => l.budgetCode));
      const updated = batch.rows.filter((l) => codes.has(l.budgetCode)).length;
      out.push(`เพิ่มรหัสงบประมาณใหม่ ${batch.rows.length - updated} รหัส · อัปเดตรหัสเดิม ${updated} รหัส`);
      break;
    }
    case "budgetProgress": {
      const codes = new Set(snap.budgetProgress.map((p) => p.budgetCode));
      const updated = batch.rows.filter((p) => codes.has(p.budgetCode)).length;
      out.push(`เพิ่มโครงการใหม่ ${batch.rows.length - updated} · อัปเดตโครงการเดิม ${updated}`);
      break;
    }
    case "activities": {
      const existing = batch.periods.filter((p) => snap.activities.some((a) => a.source === batch.source && a.period === p));
      if (existing.length) out.push(`มีข้อมูลเดือน ${existing.join(", ")} อยู่แล้ว — จะแทนที่เฉพาะเดือนนี้`);
      break;
    }
    default:
      out.push("ข้อมูลที่มีรหัสเดียวกันจะถูกอัปเดต รายการใหม่จะถูกเพิ่มต่อท้าย");
  }
  return out;
}

/**
 * multipart/form-data with `file` and optional `slot` (the row the user picked
 * the file for). `?preview=1` analyses without saving.
 */
export const POST = route(async (req) => {
  const user = await requireFeature("upload.create");
  const preview = new URL(req.url).searchParams.get("preview") === "1";

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "กรุณาเลือกไฟล์");
  const name = file.name.toLowerCase();
  if (!ALLOWED.some((ext) => name.endsWith(ext))) {
    throw new HttpError(400, "รองรับเฉพาะไฟล์ .xlsx, .xls, .csv");
  }
  if (file.size > MAX_BYTES) throw new HttpError(400, "ไฟล์ต้องมีขนาดไม่เกิน 20 MB");

  const requestedSlot = form.get("slot");
  if (requestedSlot && !SLOT_BY_KEY[String(requestedSlot)]) throw new HttpError(400, "ประเภทไฟล์ไม่ถูกต้อง");
  const slot = requestedSlot ? SLOT_BY_KEY[String(requestedSlot)] : detectSlot(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  let mode: Mode = "reject";
  let summary = "";
  let error: string | null = null;
  let financial: ParseResult | null = null;
  let warnings: string[] = [];

  if (slot) {
    try {
      const batch = parseSlotFile(slot.key, buffer, file.name);
      summary = describeBatch(batch);
      warnings = await checkBatch(batch);
      const detected = detectSlot(file.name);
      if (requestedSlot && detected && detected.key !== slot.key) {
        warnings.unshift(`ชื่อไฟล์ดูเหมือน “${detected.name}” แต่เลือกอัปโหลดเป็น “${slot.name}” — โปรดตรวจสอบอีกครั้ง`);
      }
      mode = "dataset";
    } catch (err) {
      error = `ไฟล์ไม่ตรงรูปแบบของ “${slot.name}”: ${(err as Error).message}`;
    }
  } else {
    financial = safeFinancial(buffer, file.name);
    if (financial.records.length) {
      mode = "financial";
      summary = `นำเข้าข้อมูล ${financial.records.length} รายการ`;
    } else {
      error = "ไม่รู้จักไฟล์นี้ — ตั้งชื่อไฟล์ตามรูปแบบ หรือใช้ Template";
    }
  }

  if (preview) {
    return NextResponse.json({
      slot: slot?.key ?? null,
      mode,
      summary,
      error,
      warnings,
      errorCount: financial?.errors.length ?? 0,
      errors: financial?.errors.slice(0, 50) ?? [],
    });
  }
  if (mode === "reject") throw new HttpError(400, error ?? "ไม่สามารถนำเข้าไฟล์นี้ได้");

  const date = new Date().toISOString().slice(0, 10);
  const blobName = `${slot?.key ?? "financial"}/${date}/${crypto.randomUUID()}-${file.name}`;
  const blobUrl = await uploadBlob(blobName, buffer, file.type || "application/octet-stream");

  const repo = await getRepo();
  const upload = await repo.uploads.create(
    { filename: blobName, originalName: file.name, blobUrl, sizeBytes: file.size, uploadedBy: user.id },
    mode === "financial" ? financial!.records : [],
  );
  if (mode === "dataset") await ingestFile(repo, slot!.key, buffer, file.name);

  // New data may push KPIs across alert thresholds.
  notifyAllAlertsSafely();

  return NextResponse.json({ upload: { ...upload, slot: slot?.key ?? null }, mode, summary }, { status: 201 });
});
