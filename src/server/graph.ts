import "server-only";
import { getRepo } from "@/server/repository";
import type { ProfileConsent } from "@/types/domain";

const GRAPH = "https://graph.microsoft.com/v1.0";

/**
 * MOM A7/A8: pull profile fields from Microsoft 365 (Entra ID / Teams / Outlook)
 * — only those the user consented to. Fields the user declined are cleared.
 */
export async function syncFromMicrosoft(userId: string, accessToken: string, consent: ProfileConsent) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const patch: { name?: string; email?: string; jobTitle: string | null; image: string | null } = {
    jobTitle: null,
    image: null,
  };

  if (consent.name || consent.email || consent.jobTitle) {
    const res = await fetch(`${GRAPH}/me?$select=displayName,mail,userPrincipalName,jobTitle`, { headers });
    if (!res.ok) throw new Error(`Graph /me ${res.status}`);
    const me = (await res.json()) as { displayName?: string; mail?: string; userPrincipalName?: string; jobTitle?: string };
    if (consent.name && me.displayName) patch.name = me.displayName;
    if (consent.email && (me.mail || me.userPrincipalName)) patch.email = me.mail ?? me.userPrincipalName;
    if (consent.jobTitle) patch.jobTitle = me.jobTitle ?? null;
  }

  if (consent.photo) {
    const res = await fetch(`${GRAPH}/me/photos/96x96/$value`, { headers });
    if (res.ok) {
      const type = res.headers.get("content-type") ?? "image/jpeg";
      const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
      patch.image = `data:${type};base64,${b64}`;
    }
  }

  await (await getRepo()).users.update(userId, patch);
  return patch;
}
