import "server-only";
import { EmailClient } from "@azure/communication-email";

const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
const sender = process.env.AZURE_COMMUNICATION_SENDER_ADDRESS;

export const emailConfigured = !!(connectionString && sender);

let client: EmailClient | undefined;

/** Sends via Azure Communication Services; logs instead when not configured. */
export async function sendEmail(input: { to: string[]; subject: string; html: string }) {
  const to = input.to.filter(Boolean);
  if (to.length === 0) return;

  if (!emailConfigured) {
    console.info(`[email:dev] → ${to.join(", ")} | ${input.subject}`);
    return;
  }

  client ??= new EmailClient(connectionString!);
  const poller = await client.beginSend({
    senderAddress: sender!,
    content: { subject: input.subject, html: input.html },
    recipients: { to: to.map((address) => ({ address })) },
  });
  await poller.pollUntilDone();
}

/** Minimal shared layout for notification emails. */
export function emailTemplate(title: string, body: string, link?: { href: string; label: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f1f3f6;font-family:Tahoma,Arial,sans-serif;color:#1f2937">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #d9dee7;border-radius:8px">
      <tr><td style="background:#0f2744;color:#ffffff;padding:16px 24px;font-size:16px;font-weight:bold;border-radius:8px 8px 0 0">IOD Finance Intelligence</td></tr>
      <tr><td style="padding:24px">
        <h2 style="margin:0 0 12px;font-size:18px;color:#0f2744">${title}</h2>
        <div style="font-size:14px;line-height:1.6">${body}</div>
        ${link ? `<p style="margin-top:20px"><a href="${link.href}" style="background:#0f2744;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:14px">${link.label}</a></p>` : ""}
      </td></tr>
      <tr><td style="padding:12px 24px;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb">อีเมลนี้ส่งอัตโนมัติ กรุณาอย่าตอบกลับ</td></tr>
    </table>
  </td></tr></table></body></html>`;
}
