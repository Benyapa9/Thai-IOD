import "server-only";
import { summarize } from "@/lib/finance";
import { getRepo } from "./repository";

export async function loadSummary() {
  const repo = await getRepo();
  const records = await repo.financial.list();
  return { summary: summarize(records), records };
}
