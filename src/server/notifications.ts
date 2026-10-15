import "server-only";
import { emailTemplate, sendEmail } from "@/lib/azure-email";
import type { AlertResult } from "@/server/dashboard/alerts";
import { SEVERITY_LABEL } from "@/lib/labels";
import { formatDate, formatPercent } from "@/lib/utils";
import type { IssueLog } from "@/types/domain";
import { featuresOf, usersWithFeature } from "./access";
import { getRepo } from "./repository";

/** User text goes into HTML emails — escape it. */
const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const appUrl = () => process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3000";

/** Notifications must never fail the user's request. */
function safely(label: string, task: Promise<unknown>) {
  task.catch((err) => console.error(`[notify:${label}]`, err));
}

export function notifyIssueAssigned(issue: IssueLog) {
  safely(
    "issue-assigned",
    (async () => {
      if (!issue.ownerId) return;
      const owner = await (await getRepo()).users.findById(issue.ownerId);
      if (!owner || !(await featuresOf(owner)).has("notify.issue")) return;
      await sendEmail({
        to: [owner.email],
        subject: `[IOD Finance Intelligence] มอบหมาย Follow-up Action: ${issue.title}`,
        html: emailTemplate(
          "คุณได้รับมอบหมาย Follow-up Action ใหม่",
          `<p><b>${esc(issue.title)}</b></p>
           <p>ความรุนแรง: ${SEVERITY_LABEL[issue.severity]}<br/>กำหนดเสร็จ: ${formatDate(issue.dueDate)}</p>
           ${issue.description ? `<p>${esc(issue.description)}</p>` : ""}`,
          { href: `${appUrl()}/follow-up`, label: "เปิด Follow-up Actions" },
        ),
      });
    })(),
  );
}

export async function notifyDueSoon(issues: IssueLog[]) {
  const repo = await getRepo();
  for (const issue of issues) {
    if (!issue.ownerId) continue;
    const owner = await repo.users.findById(issue.ownerId);
    if (!owner || !(await featuresOf(owner)).has("notify.issue")) continue;
    await sendEmail({
      to: [owner.email],
      subject: `[IOD Finance Intelligence] Follow-up ใกล้ครบกำหนด: ${issue.title}`,
      html: emailTemplate(
        "Follow-up Action ใกล้ครบกำหนด (พรุ่งนี้)",
        `<p><b>${esc(issue.title)}</b><br/>กำหนดเสร็จ: ${formatDate(issue.dueDate)}</p>`,
        { href: `${appUrl()}/follow-up`, label: "เปิด Follow-up Actions" },
      ),
    });
  }
}

export async function notifyThresholdBreach(alerts: AlertResult[]) {
  const breached = alerts.filter((a) => a.breached);
  if (breached.length === 0) return;
  const recipients = await usersWithFeature("notify.kpi");
  const rows = breached
    .map(
      (a) =>
        `<li>${a.dashboardLabel} — ${a.label}: <b>${formatPercent(a.value)}</b> (เกณฑ์ ${a.operator === "gt" ? ">" : "<"} ${a.threshold}%)</li>`,
    )
    .join("");
  await sendEmail({
    to: recipients.map((u) => u.email),
    subject: `[IOD Finance Intelligence] แจ้งเตือน KPI เกินเกณฑ์ ${breached.length} รายการ`,
    html: emailTemplate("KPI เกินเกณฑ์ที่กำหนด", `<ul>${rows}</ul>`, {
      href: `${appUrl()}/dashboard`,
      label: "เปิด Dashboard",
    }),
  });
}

export function notifyThresholdBreachSafely(alerts: AlertResult[]) {
  safely("threshold", notifyThresholdBreach(alerts));
}

/** Re-evaluate every dashboard's thresholds (all departments) after data or threshold changes. */
export function notifyAllAlertsSafely() {
  safely(
    "threshold",
    (async () => {
      const { loadContext, resolveFilters } = await import("@/server/dashboard/service");
      const { evaluateAlerts } = await import("@/server/dashboard/alerts");
      const ctx = await loadContext();
      const thresholds = await (await getRepo()).thresholds.list();
      await notifyThresholdBreach(evaluateAlerts(ctx, resolveFilters(ctx, {}, null), thresholds));
    })(),
  );
}
