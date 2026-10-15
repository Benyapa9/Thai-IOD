import Anthropic from "@anthropic-ai/sdk";
import { formatPercent, formatTHB } from "@/lib/utils";
import { type AlertResult, evaluateAlerts } from "@/server/dashboard/alerts";
import { type DashboardContext, type Filters } from "@/server/dashboard/context";
import { capitalPage, kpiPage, membershipPage, pnlPage, trainingPage } from "@/server/dashboard/pages";
import { loadContext, resolveFilters, thaiMonthYear } from "@/server/dashboard/service";
import { allowedDepartments, route, requireFeature } from "@/server/http";
import { type Insight, buildInsights } from "@/server/insights";
import { getRepo } from "@/server/repository";
import { chatSchema } from "@/server/validation";

// Spec: Anthropic Haiku for the assistant (override with AI_MODEL).
const MODEL = process.env.AI_MODEL || "claude-haiku-4-5";

/** FINLEY — the floating assistant (MOM I9), aware of every dashboard. */
const SYSTEM_PROMPT = `คุณคือ "FINLEY" ผู้ช่วยวิเคราะห์ข้อมูลการเงินใน IOD Finance Intelligence ของ Thai Institute of Directors (Thai IOD) พัฒนาโดย ZyGen

แนวทาง:
- ตอบเป็นภาษาเดียวกับคำถาม กระชับ ตรงประเด็น ใช้ตัวเลขจากข้อมูลด้านล่างเท่านั้น
- ถ้าข้อมูลไม่พอให้บอกตรง ๆ ว่าไม่มีข้อมูล อย่าเดาตัวเลข
- จำนวนเงินเป็นบาท (THB) ใช้คั่นหลักพัน หรือหน่วยล้านบาท (MB)
- เมื่อเหมาะสม แนะนำหน้า Dashboard ที่ควรเปิดดูต่อ และข้อเสนอแนะเชิงปฏิบัติ
- ข้อมูลนี้ถูกจำกัดตามหน่วยงานที่ผู้ใช้มีสิทธิ์ดู`;

const mb = (n: number) => `${(n / 1e6).toFixed(1)} MB`;

function contextBlock(ctx: DashboardContext, flt: Filters, alerts: AlertResult[], insights: Insight[]) {
  const k = kpiPage(ctx, flt);
  const t = trainingPage(ctx, flt);
  const m = membershipPage(ctx, flt);
  const p = pnlPage(ctx, flt);
  const c = capitalPage(ctx, flt);
  const scope = flt.departments.length ? `หน่วยงาน: ${flt.departments.join(", ")}` : "ทุกหน่วยงาน";
  return [
    `ข้อมูลถึงเดือน ${thaiMonthYear(flt.year, flt.month)} (สะสมตั้งแต่ต้นปี) · ${scope}`,
    `รายได้ ${mb(k.revenue.actual)} เทียบแผน ${mb(k.revenue.plan)} (${k.revenue.achievePct.toFixed(1)}%) · แผนทั้งปี ${mb(k.revenue.planFull)}`,
    `ค่าใช้จ่าย ${mb(k.expense.actual)} เทียบงบ ${mb(k.expense.plan)} (${k.expense.achievePct.toFixed(1)}%)`,
    `รายได้สูงกว่าค่าใช้จ่าย ${mb(k.net.actual)} เทียบแผน ${mb(k.net.plan)} · EBITDA ${mb(k.ebitda.actual)} (${k.ebitda.actualPct.toFixed(1)}% ของ NOI)`,
    "รายเดือน (รายได้/ค่าใช้จ่าย ล้านบาท):",
    ...k.monthly.filter((x) => x.revenueActual !== null).map((x) => `- ${x.label}: ${mb(x.revenueActual ?? 0)} / ${mb(x.expenseActual ?? 0)}`),
    "รายได้ตาม Profit Center (จริง/แผน):",
    ...k.byProfitCenter.slice(0, 10).map((x) => `- ${x.profitCenter}: ${mb(x.actual)} / ${mb(x.plan)}`),
    `หลักสูตร: รายได้ ${mb(t.revenue.actual)} / แผน ${mb(t.revenue.plan)} · ${t.counts.courses} หลักสูตร ${t.counts.classes} รุ่น`,
    `สมาชิก ${mb(m.membership.actual)} / ${mb(m.membership.plan)} · สปอนเซอร์ ${mb(m.sponsorship.actual)} / ${mb(m.sponsorship.plan)} · สัมมนา ${mb(m.seminar.actual)} / ${mb(m.seminar.plan)}`,
    `P&L: Net Operating Income ${mb(p.operatingIncome.actual)} เทียบแผนทั้งปี ${mb(p.operatingIncome.plan)}`,
    `CAPEX: ใช้ไป ${mb(c.outlay.actual)} จากงบถึงเดือนนี้ ${mb(c.outlay.plan)} · Delay ${c.statusCounts.delay} โครงการ`,
    "เกณฑ์แจ้งเตือนที่เกิน:",
    ...alerts.filter((a) => a.breached).map((a) => `- ${a.dashboardLabel} · ${a.label}: ${formatPercent(a.value)} (เกณฑ์ ${a.operator} ${a.threshold})`),
    "Insights:",
    ...insights.map((i) => `- [${i.level}] ${i.title} — ${i.detail}${i.impact ? ` (${i.impact.text})` : ""}`),
  ].join("\n");
}

/** Used when ANTHROPIC_API_KEY is not configured so the assistant still works in dev. */
function offlineAnswer(question: string, ctx: DashboardContext, flt: Filters, insights: Insight[]) {
  const q = question.toLowerCase();
  const k = kpiPage(ctx, flt);
  const note = "\n\n(โหมดออฟไลน์ — ตั้งค่า ANTHROPIC_API_KEY เพื่อให้ FINLEY ตอบได้ละเอียดขึ้น)";
  if (/งบ|budget|ค่าใช้จ่าย|expense/.test(q)) {
    return `ค่าใช้จ่ายสะสม ${formatTHB(k.expense.actual)} เทียบงบ ${formatTHB(k.expense.plan)} (${k.expense.achievePct.toFixed(1)}%)\n${insights
      .filter((i) => i.kind === "expense-dept")
      .slice(0, 5)
      .map((i) => `• ${i.title} ${i.metric.value}`)
      .join("\n")}${note}`;
  }
  if (/รายได้|revenue/.test(q)) {
    return `รายได้สะสม ${formatTHB(k.revenue.actual)} เทียบแผน ${formatTHB(k.revenue.plan)} (${k.revenue.achievePct.toFixed(1)}%)\n${k.byProfitCenter
      .slice(0, 5)
      .map((x) => `• ${x.profitCenter}: ${formatTHB(x.actual)} / แผน ${formatTHB(x.plan)}`)
      .join("\n")}${note}`;
  }
  const top = insights.slice(0, 4).map((i) => `• ${i.title} (${i.metric.value})`).join("\n");
  return `ข้อมูลถึง ${thaiMonthYear(flt.year, flt.month)}: รายได้ ${formatTHB(k.revenue.actual)}, ค่าใช้จ่าย ${formatTHB(k.expense.actual)}, EBITDA ${formatTHB(k.ebitda.actual)}\n\nประเด็นที่ควรติดตาม:\n${top}${note}`;
}

const encoder = new TextEncoder();
const sse = (data: unknown) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`);

export const POST = route(async (req) => {
  const user = await requireFeature("agent.chat");
  const { messages } = chatSchema.parse(await req.json());

  const ctx = await loadContext();
  const flt = resolveFilters(ctx, {}, allowedDepartments(user));
  const repo = await getRepo();
  const [thresholds, issues] = await Promise.all([repo.thresholds.list(), repo.issues.list()]);
  const alerts = evaluateAlerts(ctx, flt, thresholds);
  const insights = buildInsights(ctx, flt, alerts, issues, thaiMonthYear(flt.year, flt.month));

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!process.env.ANTHROPIC_API_KEY) {
          const chars = Array.from(offlineAnswer(messages.at(-1)!.content, ctx, flt, insights));
          for (let i = 0; i < chars.length; i += 24) {
            controller.enqueue(sse({ text: chars.slice(i, i + 24).join("") }));
            await new Promise((r) => setTimeout(r, 15));
          }
        } else {
          const client = new Anthropic();
          const response = client.messages.stream(
            {
              model: MODEL,
              max_tokens: 4096,
              system: [
                { type: "text", text: SYSTEM_PROMPT },
                { type: "text", text: `ข้อมูลปัจจุบันในระบบ:\n${contextBlock(ctx, flt, alerts, insights)}` },
              ],
              messages,
            },
            { signal: req.signal },
          );
          for await (const event of response) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              controller.enqueue(sse({ text: event.delta.text }));
            }
          }
          const final = await response.finalMessage();
          if (final.stop_reason === "refusal") {
            controller.enqueue(sse({ text: "\n\n(ไม่สามารถตอบคำถามนี้ได้)" }));
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        if (err instanceof Anthropic.AuthenticationError) {
          controller.enqueue(sse({ error: "API key ไม่ถูกต้อง" }));
        } else if (err instanceof Anthropic.RateLimitError) {
          controller.enqueue(sse({ error: "ใช้งานถี่เกินไป กรุณาลองใหม่ภายหลัง" }));
        } else if (err instanceof Anthropic.APIUserAbortError) {
          // client closed the chat
        } else {
          console.error("[ai/chat]", err);
          controller.enqueue(sse({ error: "FINLEY ไม่สามารถตอบได้ในขณะนี้" }));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});
