import { route, requireFeature } from "@/server/http";

const TEMPLATE = [
  "period,category,revenue,expense,budget",
  "2026-09,training,4500000,3000000,3150000",
  "2026-09,membership,1850000,620000,650000",
  "2026-09,sponsorship,1250000,480000,450000",
  "2026-09,corporate,2500000,1620000,1700000",
].join("\r\n");

export const GET = route(async () => {
  await requireFeature("upload.create");
  return new Response(`﻿${TEMPLATE}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="iod-financial-template.csv"',
    },
  });
});
