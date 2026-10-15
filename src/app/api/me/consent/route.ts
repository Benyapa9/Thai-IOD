import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { AppToken } from "@/lib/auth";
import { syncFromMicrosoft } from "@/server/graph";
import { route, toPublicUser, requireFeature } from "@/server/http";
import { getRepo } from "@/server/repository";
import { consentSchema } from "@/server/validation";

/**
 * Save which Microsoft profile fields the user allows (MOM A7/A8) and sync them
 * right away when a Microsoft session is available. Declined fields are cleared.
 */
export const POST = route(async (req) => {
  const user = await requireFeature();
  const choice = consentSchema.parse(await req.json());
  const consent = { ...choice, decidedAt: new Date().toISOString() };
  const repo = await getRepo();
  await repo.users.update(user.id, {
    consent,
    ...(choice.jobTitle ? {} : { jobTitle: null }),
    ...(choice.photo ? {} : { image: null }),
  });

  let synced = false;
  let syncMessage: string | null = null;
  const token = (await getToken({
    req,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    secureCookie: req.url.startsWith("https://"),
  }).catch(() => null)) as (AppToken & Record<string, unknown>) | null;

  if (token?.msAccessToken && (!token.msTokenExpires || token.msTokenExpires > Date.now())) {
    try {
      await syncFromMicrosoft(user.id, token.msAccessToken, consent);
      synced = true;
    } catch (err) {
      syncMessage = `ซิงก์ไม่สำเร็จ: ${(err as Error).message}`;
    }
  } else {
    syncMessage = "ไม่ได้เข้าสู่ระบบด้วย Microsoft ในรอบนี้ — ระบบจะซิงก์ให้เมื่อเข้าสู่ระบบด้วย Microsoft ครั้งถัดไป";
  }

  const updated = await repo.users.findById(user.id);
  return NextResponse.json({ user: updated && toPublicUser(updated), synced, syncMessage });
});
