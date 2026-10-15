import "server-only";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { detectSlot } from "@/lib/upload-slots";
import type { Repository } from "@/server/repository/types";
import { buildContext, type Fact, norm } from "@/server/dashboard/context";
import type { Category, NewFinancialRecord } from "@/types/domain";
import type { DatasetBatch } from "@/types/dataset";
import { parseSlotFile } from "./parsers";

/** Short human summary of what a parsed file contains. */
export function describeBatch(batch: DatasetBatch) {
  switch (batch.kind) {
    case "gl":
      return `รายการ GL ${batch.rows.length} รายการ (งวด ${batch.periods.join(", ")})`;
    case "budgetLines":
      return `รายการงบประมาณปี ${batch.years.join(", ")} จำนวน ${batch.rows.length} รหัส`;
    case "budgetProgress":
      return `ความคืบหน้างบรายโครงการ ${batch.rows.length} โครงการ`;
    case "accountMap":
      return `จับคู่บัญชีกับหลักสูตร ${batch.rows.length} รายการ`;
    case "pnlLines":
      return `โครงสร้าง P&L ${batch.rows.length} บรรทัด`;
    case "departments":
      return `หน่วยงาน ${batch.rows.length} หน่วยงาน`;
    case "memberStats":
      return `สถิติสมาชิก ${batch.rows.length} รายการ`;
    case "activities":
      return `กิจกรรม ${batch.rows.length} รายการ (รวม ${batch.rows.reduce((s, a) => s + a.registrations, 0)} การลงทะเบียน)`;
  }
}

// ── FinancialRecord bridge (keeps Insights / Scenario / AI on real data) ──

const TRAINING_REV = new Set(["publictrainning", "inhousetraining", "inhousecac", "cactraining", "seminars"]);
const TRAINING_PC = new Set(["trainingpublic", "traninginhouse", "cac", "seminars", "directordevelopmentservices"]);

function categoryOf(f: Fact): Category {
  if (f.kind === "revenue") {
    if (TRAINING_REV.has(f.pnlKey)) return "training";
    if (f.pnlKey === "membershipfees") return "membership";
    if (f.pnlKey.startsWith("revenuefromdonations") || f.pnlKey === "passthroughsponsorship") return "sponsorship";
    return "corporate";
  }
  const pc = norm(f.profitCenter);
  if (TRAINING_PC.has(pc)) return "training";
  if (pc === "member" || pc === "event") return "membership";
  if (pc === "sponsor" || pc === "cgr" || pc === "aseancg") return "sponsorship";
  return "corporate";
}

export async function rebuildDerived(repo: Repository) {
  const ctx = buildContext(await repo.dataset.snapshot());
  if (!ctx.facts.length) return;
  const totals = new Map<string, NewFinancialRecord>();
  for (const f of ctx.facts) {
    if (f.isCapital) continue; // งบลงทุน is not an operating figure
    const type = f.scenario === "budget" ? "budget" : f.kind;
    // FinancialRecord "budget" means the expense budget.
    if (f.scenario === "budget" && f.kind === "revenue") continue;
    const period = `${f.year}-${String(f.month).padStart(2, "0")}`;
    const category = categoryOf(f);
    const key = `${period}|${category}|${type}`;
    const r = totals.get(key) ?? { period, periodType: "monthly", category, type, amount: 0, currency: "THB" };
    r.amount += f.amount;
    totals.set(key, r);
  }
  await repo.financial.replaceDerived([...totals.values()].map((r) => ({ ...r, amount: Math.round(r.amount * 100) / 100 })));
}

export async function ingestFile(repo: Repository, slot: string, buffer: Buffer, filename: string) {
  const batch = parseSlotFile(slot, buffer, filename);
  await repo.dataset.applyBatch(batch);
  await rebuildDerived(repo);
  return batch;
}

// ── Local folder import (dev convenience, DATA_IMPORT_DIR) ───

/** Masters first so later files resolve against them. */
const IMPORT_ORDER = [
  "dept_master",
  "master_revenue",
  "master",
  "bg_year",
  "bg_capital",
  "actual",
  "template_member",
  "event",
  "member",
  "sponsor",
];

export async function importDirectory(repo: Repository, dir: string) {
  const files = (await readdir(dir)).filter((f) => /\.(xlsx|xls|csv)$/i.test(f) && !f.startsWith("~$"));
  const matched = files
    .map((f) => ({ file: f, slot: detectSlot(f)?.key }))
    .filter((x): x is { file: string; slot: string } => !!x.slot)
    .sort((a, b) => IMPORT_ORDER.indexOf(a.slot) - IMPORT_ORDER.indexOf(b.slot) || a.file.localeCompare(b.file));

  const results: { file: string; slot: string; ok: boolean; message: string }[] = [];
  for (const { file, slot } of matched) {
    try {
      const buffer = await readFile(path.join(dir, file));
      const batch = parseSlotFile(slot, buffer, file);
      await repo.dataset.applyBatch(batch);
      // Record it like a normal upload so the Upload page shows the slot as ready.
      await repo.uploads.create(
        {
          filename: `${slot}/folder-import/${file}`,
          originalName: file,
          blobUrl: `file://${path.join(dir, file)}`,
          sizeBytes: buffer.length,
          uploadedBy: "system",
        },
        [],
      );
      results.push({ file, slot, ok: true, message: describeBatch(batch) });
    } catch (err) {
      results.push({ file, slot, ok: false, message: (err as Error).message });
    }
  }
  await rebuildDerived(repo);
  for (const r of results) console.info(`[import] ${r.ok ? "✓" : "✗"} ${r.file} — ${r.message}`);
  return results;
}
