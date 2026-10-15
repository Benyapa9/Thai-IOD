/**
 * Parse a local folder of source files and print the dashboard figures —
 * a quick reconciliation check against the Power BI reports.
 *
 *   npx tsx --conditions=react-server scripts/check-dataset.ts "<folder>" [YYYY-MM]
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { detectSlot } from "@/lib/upload-slots";
import { buildContext } from "@/server/dashboard/context";
import { capitalPage, expenditurePage, kpiPage, membershipPage, pnlPage, trainingPage } from "@/server/dashboard/pages";
import { resolveFilters } from "@/server/dashboard/service";
import { describeBatch } from "@/server/ingest";
import { parseSlotFile } from "@/server/ingest/parsers";
import { emptySnapshot } from "@/server/repository/types";
import type { DatasetSnapshot } from "@/types/dataset";

const [dir, period] = process.argv.slice(2);
const mb = (n: number) => (n / 1e6).toFixed(1);

async function main() {
  const snap: DatasetSnapshot = emptySnapshot();
  for (const file of await readdir(dir)) {
    const slot = detectSlot(file)?.key;
    if (!slot || !/\.(xlsx|xls|csv)$/i.test(file)) continue;
    try {
      const batch = parseSlotFile(slot, await readFile(path.join(dir, file)), file);
      switch (batch.kind) {
        case "gl": snap.gl.push(...batch.rows); break;
        case "budgetLines": snap.budgetLines.push(...batch.rows); break;
        case "budgetProgress": snap.budgetProgress = batch.rows; break;
        case "accountMap": snap.accountMap = batch.rows; break;
        case "pnlLines": snap.pnlLines = batch.rows; break;
        case "departments": snap.departments = batch.rows; break;
        case "memberStats": snap.memberStats = batch.rows; break;
        case "activities": snap.activities.push(...batch.rows); break;
      }
      console.log(`✓ ${file} → ${describeBatch(batch)}`);
    } catch (err) {
      console.log(`✗ ${file} → ${(err as Error).message}`);
    }
  }

  const ctx = buildContext(snap);
  const flt = resolveFilters(ctx, { period }, null);
  console.log("\nFilters", flt, "actual months", Object.fromEntries(ctx.actualMonths));


  const blk = (n: string, b: { actual: number; plan: number; planFull: number; balance: number; achievePct: number }) =>
    console.log(`[${n.padEnd(9)}] actual ${mb(b.actual)}  plan YTD ${mb(b.plan)}  full-year ${mb(b.planFull)}  balance ${mb(b.balance)}  achieve ${b.achievePct.toFixed(1)}%`);

  const k = kpiPage(ctx, flt);
  blk("revenue", k.revenue);
  blk("expense", k.expense);
  blk("profit", k.net);
  console.log("[KPI] EBITDA actual", mb(k.ebitda.actual), `${k.ebitda.actualPct.toFixed(1)}%`, "budget", mb(k.ebitda.budget), `${k.ebitda.budgetPct.toFixed(1)}%`);

  const t = trainingPage(ctx, flt);
  blk("train rev", t.revenue);
  blk("train exp", t.expense);
  console.log("[Training] counts", t.counts, t.marginByGroup.map((g) => `${g.name} ${g.marginPct.toFixed(1)}%`));

  const e = expenditurePage(ctx, flt);
  blk("exp page", e.expense);
  console.log("[Expense] top types", e.byType.slice(0, 4).map((x) => `${x.label}=${mb(x.actual)}`));

  const m = membershipPage(ctx, flt);
  blk("member", m.membership);
  blk("sponsor", m.sponsorship);
  blk("seminar", m.seminar);
  console.log("[Member] counts", m.counts, "types", m.memberTypes);
  console.log("[Member] renew Aug", JSON.stringify(m.retention[7]), "\n[Member] new Aug", JSON.stringify(m.acquisition[7]));

  const p = pnlPage(ctx, flt);
  console.log("\n[P&L] Operating income", mb(p.operatingIncome.actual), "/", mb(p.operatingIncome.plan), `${p.operatingIncome.achievePct.toFixed(1)}%`);
  for (const r of p.rows) {
    const v = r.values;
    if (!v) {
      console.log(r.label);
      continue;
    }
    console.log(
      `${r.label.slice(0, 44).padEnd(45)} B ${mb(v.budget).padStart(7)} ${v.budgetPct.toFixed(1).padStart(6)}% | BY ${mb(v.budgetYtd).padStart(7)} | A ${mb(v.actualYtd).padStart(7)} ${v.actualYtdPct.toFixed(1).padStart(6)}% | next ${mb(v.budgetNext).padStart(6)} | proj ${mb(v.projection).padStart(7)} | rem ${mb(v.remaining).padStart(7)} | togo ${mb(v.toGoPlan).padStart(7)} | outlook ${mb(v.outlook).padStart(7)}`,
    );
  }

  const c = capitalPage(ctx, flt);
  console.log("\n[CAPEX]", c.asOf, "used", mb(c.outlay.actual), "budget YTD", mb(c.outlay.plan), "full", mb(c.outlay.planFull), c.statusCounts, "projects", c.projects.length);
}

main();
