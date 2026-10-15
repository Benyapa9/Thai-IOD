import { NextResponse } from "next/server";
import { SECTIONS, type SectionKey, sectionOf } from "@/lib/sections";
import { route, requireFeature } from "@/server/http";
import { getRepo } from "@/server/repository";
import { usageSchema } from "@/server/validation";

/** Record a page view. */
export const POST = route(async (req) => {
  const user = await requireFeature();
  const { path } = usageSchema.parse(await req.json());
  const section = sectionOf(path);
  if (section) await (await getRepo()).usage.record({ userId: user.id, path, section });
  return new NextResponse(null, { status: 204 });
});

const DAY = 24 * 60 * 60 * 1000;

/** My Usage Log (MOM F4): my activity this week vs other users, most-visited pages. */
export const GET = route(async () => {
  const user = await requireFeature();
  const since = new Date(Date.now() - 28 * DAY);
  const events = await (await getRepo()).usage.list(since);
  const weekStart = Date.now() - 7 * DAY;

  const mine = events.filter((e) => e.userId === user.id);
  const thisWeek = events.filter((e) => +e.createdAt >= weekStart);
  const others = new Map<string, number>();
  for (const e of thisWeek) if (e.userId !== user.id) others.set(e.userId, (others.get(e.userId) ?? 0) + 1);
  const othersAvg = others.size ? [...others.values()].reduce((a, b) => a + b, 0) / others.size : 0;

  const bySection = new Map<string, number>();
  for (const e of mine) bySection.set(e.section, (bySection.get(e.section) ?? 0) + 1);
  const topPages = [...bySection.entries()]
    .map(([key, count]) => ({ key, label: SECTIONS[key as SectionKey]?.label.th ?? key, count }))
    .sort((a, b) => b.count - a.count);

  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(Date.now() - (27 - i) * DAY);
    const key = d.toISOString().slice(0, 10);
    return { date: key, count: mine.filter((e) => e.createdAt.toISOString().slice(0, 10) === key).length };
  });

  return NextResponse.json({
    thisWeek: mine.filter((e) => +e.createdAt >= weekStart).length,
    lastWeek: mine.filter((e) => +e.createdAt >= weekStart - 7 * DAY && +e.createdAt < weekStart).length,
    othersAverage: Math.round(othersAvg * 10) / 10,
    otherUsers: others.size,
    activeDays: new Set(mine.filter((e) => +e.createdAt >= weekStart).map((e) => e.createdAt.toISOString().slice(0, 10))).size,
    topPages,
    days,
  });
});
