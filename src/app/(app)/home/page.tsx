"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Compass,
  CalendarRange,
  Eye,
  Siren,
  Check,
  ListChecks,
  Lightbulb,
  LayoutDashboard,
  SlidersHorizontal,
  Sparkles,
  ThumbsDown,
  ShieldAlert,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useCurrentUser, usePrefs, useT } from "@/components/layout/user-context";
import { RatingFeedbackDialog } from "@/components/insights/rating-feedback";
import { HomeNotes } from "@/components/notes/personal-notes";
import { Reveal } from "@/components/ui/reveal";
import { Card } from "@/components/ui/card";
import { ErrorBlock, IconBadge, LoadingBlock } from "@/components/ui/misc";
import { type HomeResponse, keys, useHome } from "@/hooks/queries";
import { api } from "@/lib/api";
import type { FeatureKey } from "@/lib/access/catalog";
import { tierLabel } from "@/lib/rbac";
import { SECTIONS, type SectionKey } from "@/lib/sections";
import { cn, formatDate, formatMB } from "@/lib/utils";

const SECTION_ICON: Partial<Record<SectionKey, typeof Lightbulb>> = {
  insight: Lightbulb,
  dashboard: LayoutDashboard,
  scenario: SlidersHorizontal,
  followUp: ListChecks,
};
const SECTION_HINT: Partial<Record<SectionKey, string>> = {
  insight: "สัญญาณสำคัญที่ควรรู้ เรียงตามความเร่งด่วน",
  dashboard: "รายงาน KPI, P&L และ Capital แบบละเอียด",
  scenario: "ทดลองปรับสมมติฐานรายได้/ค่าใช้จ่าย",
  followUp: "ติดตามแผนแก้ไขและผลลัพธ์",
};

/** Shown after a page guard sent the user here (→ /home?denied=1). */
function DeniedNotice({ tier }: { tier: string }) {
  const denied = useSearchParams().get("denied") === "1";
  if (!denied) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-navy-900">
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden />
      หน้าที่คุณเปิดยังไม่เปิดให้ระดับ {tier} ใช้งาน จึงพากลับมาที่หน้าแรก หากจำเป็นต้องใช้ กรุณาติดต่อผู้ดูแลระบบ (ฝ่าย IT) เพื่อขอสิทธิ์
    </p>
  );
}

export default function HomePage() {
  const { data, isLoading, error } = useHome();
  const user = useCurrentUser();
  const t = useT();

  if (isLoading) return <LoadingBlock />;
  if (error || !data) return <ErrorBlock error={error} />;


  return (
    <div className="space-y-6">
      <DeniedNotice tier={tierLabel(user.tier)} />
      <Reveal variant="zoom">
        <section className="relative overflow-hidden rounded-2xl bg-navy-900 p-6 text-white shadow-xl sm:p-8">
          {/* Banner photo; the left side is plain blue, where the text sits. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative static banner */}
          <img
            src="/brand/home-hero.webp"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 size-full object-cover object-right"
          />
          {/* Readability: darken behind the text, let the photo show on the right. */}
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-navy-950/85 via-navy-900/55 to-transparent max-sm:via-navy-950/70 max-sm:to-navy-950/40"
            aria-hidden="true"
          />
          <div className="relative max-w-xl">
            {/* Brand lockup: Thai IOD logo | FINANCE INTELLIGENCE */}
            <div className="flex items-center gap-3">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-white p-1 shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
                <img src="/brand/thai-iod-logo.png" alt="Thai Institute of Directors" className="size-12" />
              </span>
              <span className="h-12 w-px bg-white/40" aria-hidden="true" />
              <span className="leading-none">
                <span className="block text-xl font-extrabold tracking-wide sm:text-2xl">FINANCE</span>
                <span className="mt-0.5 block text-xl font-extrabold tracking-wide text-accent-light sm:text-2xl">INTELLIGENCE</span>
                <span className="mt-1 block text-[10px] tracking-[0.2em] text-white/75">INSIGHT. ACCURACY. CONFIDENCE.</span>
              </span>
            </div>

            <p className="mt-6 text-xl text-white/90">{t("home.greeting") === "Hello" ? "Hello," : "สวัสดี,"}</p>
            <h1 className="text-3xl font-bold drop-shadow sm:text-4xl">{user.name}</h1>
            <span className="mt-3 block h-1 w-10 rounded-full bg-accent" aria-hidden="true" />
            <p className="mt-3 text-lg font-medium">ขับเคลื่อนข้อมูล สู่การตัดสินใจที่มั่นใจ</p>
            <p className="text-sm text-white/75">Insight. Accuracy. Confidence.</p>
          </div>
          <div className="relative mt-5 flex flex-wrap items-center gap-2 text-xs">
            {data.scope && (
              <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 backdrop-blur-md">
                <CalendarRange className="size-4 shrink-0 text-white/90" aria-hidden />
                ข้อมูล Actual <b className="font-semibold tabular-nums">{data.scope.dateLabel ?? data.scope.label}</b>
              </span>
            )}
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 backdrop-blur">{tierLabel(user.tier)} User</span>
            {user.departments && (
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 backdrop-blur">ดูข้อมูล {user.departments.length} หน่วยงาน</span>
            )}
            {data.myOpenFollowUps > 0 && (
              <Link href="/follow-up?mine=1" className="rounded-full bg-white px-3 py-1 font-semibold text-navy-900 shadow hover:bg-white/90">
                Follow-up ของคุณที่ค้างอยู่ {data.myOpenFollowUps} รายการ →
              </Link>
            )}
          </div>
        </section>
      </Reveal>


      <HomeNotes />
      <Reveal variant="zoom">
        <InsightOfDay data={data} />
      </Reveal>
      <Reveal delay={120}>
        <GuideProgress data={data} />
      </Reveal>

      <InsightSummary data={data} />
      <QuickAccess />
    </div>
  );
}

/** Main areas as large cards at the bottom of Home (replaces the old "What's new" box; that list now opens from the sidebar). */
function QuickAccess() {
  const user = useCurrentUser();
  const can = (f: FeatureKey) => user.features.includes(f);
  const tiles = [
    { href: "/insights", label: "Insight", hint: "สัญญาณสำคัญวันนี้ เรียงตามความเร่งด่วน", icon: Lightbulb, grad: "from-navy-900 to-navy-600", feature: "insights.view" },
    { href: "/dashboard", label: "Dashboard", hint: "รายงาน KPI, P&L และ Capital แบบละเอียด", icon: LayoutDashboard, grad: "from-navy-800 to-navy-500", feature: "dashboard.view" },
    { href: "/scenario", label: "Scenario", hint: "ทดลองปรับสมมติฐาน What-if แล้วดูผลทันที", icon: SlidersHorizontal, grad: "from-navy-700 to-navy-400", feature: "scenario.use" },
    { href: "/follow-up", label: "Follow-up", hint: "ติดตามแผนแก้ไข ผู้รับผิดชอบ และกำหนดเสร็จ", icon: ListChecks, grad: "from-navy-900 to-navy-500", feature: "issues.view" },
    { href: "/upload", label: "อัปโหลดข้อมูล", hint: "เพิ่มไฟล์ Actual / Budget ล่าสุดเข้าระบบ", icon: UploadCloud, grad: "from-navy-800 to-navy-400", feature: "upload.create" },
  ].filter((tile) => can(tile.feature as FeatureKey));
  if (!tiles.length) return null;
  return (
    <section aria-labelledby="quick-access-title">
      <h2 id="quick-access-title" className="mb-3 flex items-center gap-2.5 text-base font-semibold text-navy-900">
        <IconBadge icon={Compass} tone="navy" size="sm" /> เข้าสู่เมนูหลัก
      </h2>
      <div className={cn("grid gap-4 sm:grid-cols-2", tiles.length >= 5 ? "lg:grid-cols-5" : tiles.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        {tiles.map((tile, i) => (
          <Reveal key={tile.href} delay={i * 80} variant="zoom">
            <Link
              href={tile.href}
              className="lift group gradient-border relative flex h-full min-h-44 flex-col overflow-hidden rounded-2xl bg-white p-5 shadow-sm"
            >
              {/* soft theme glow in the corner */}
              <span className={cn("pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-gradient-to-br opacity-15 blur-2xl transition-opacity group-hover:opacity-30", tile.grad)} aria-hidden />
              <span className={cn("relative flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ring-1 ring-white/30", tile.grad)}>
                <tile.icon className="size-7" />
              </span>
              <span className="relative mt-4 block text-lg font-bold text-navy-900">{tile.label}</span>
              <span className="relative mt-1 block text-sm leading-snug text-muted-foreground">{tile.hint}</span>
              <span className="relative mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-navy-700 group-hover:text-navy-900">
                เปิด {tile.label} <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/** MOM H1 — personalised guide: "visited 3 of 4 menus". */
function GuideProgress({ data }: { data: HomeResponse }) {
  const t = useT();
  const { locale } = usePrefs();
  const { visitedCount, total, sections } = data.guide;
  const done = visitedCount >= total;
  return (
    <Card className="gradient-border flex flex-col gap-4 rounded-2xl p-5 lg:flex-row lg:items-center">
      <div className="flex shrink-0 items-center gap-3 lg:w-60">
        <ProgressRing value={visitedCount} total={total} />
        <div>
          <p className="text-sm font-semibold text-navy-900">
            {done ? t("home.progressDone") : t("home.progress", { n: visitedCount, total })}
          </p>
          <p className="text-xs text-muted-foreground">{done ? "พร้อมใช้งานเต็มที่แล้ว" : t("home.explore")}</p>
        </div>
      </div>
      <ul className="grid flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {sections.map((s) => {
          const key = s.key as SectionKey;
          const Icon = SECTION_ICON[key] ?? Lightbulb;
          return (
            <li key={s.key}>
              <Link
                href={SECTIONS[key].href}
                className={cn(
                  "group flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
                  s.visited ? "border-success/20 bg-success-soft/50" : "border-amber-200 bg-amber-50 hover:bg-amber-100",
                )}
              >
                <span className={cn("flex size-8 items-center justify-center rounded-full", s.visited ? "bg-success text-white" : "bg-amber-500 text-white")}>
                  {s.visited ? <Check className="size-4" /> : <Icon className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-navy-900">{SECTIONS[key].label[locale]}</span>
                  <span className="block truncate text-xs text-muted-foreground">{SECTION_HINT[key]}</span>
                </span>
                {!s.visited && <span className="text-xs font-medium text-amber-700 group-hover:underline">ลองเลย</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function ProgressRing({ value, total }: { value: number; total: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const p = total ? value / total : 0;
  return (
    <svg viewBox="0 0 56 56" className="size-14 shrink-0" aria-hidden>
      <circle cx="28" cy="28" r={r} fill="none" stroke="var(--color-navy-100)" strokeWidth="6" />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke={p >= 1 ? "var(--color-success)" : "#f59e0b"}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${c * p} ${c}`}
        transform="rotate(-90 28 28)"
      />
      <text x="28" y="32" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--color-navy-900)">
        {value}/{total}
      </text>
    </svg>
  );
}

/** MOM H2/H3 — one insight a day, liked/disliked to learn preferences. */
function InsightOfDay({ data }: { data: HomeResponse }) {
  const t = useT();
  const qc = useQueryClient();
  const insight = data.insightOfDay;
  const [rated, setRated] = useState(insight?.myRating ?? 0);
  const [ask, setAsk] = useState<1 | -1 | null>(null);
  const rate = useMutation({
    mutationFn: (rating: 1 | -1) => api.send("/api/ratings", "POST", { insightKey: insight!.id, kind: insight!.kind, rating }),
    onSuccess: (_, rating) => {
      setRated(rating);
      setAsk(rating);
    },
  });
  // Refresh Home (a disliked pick may be replaced) only after the popup closes, so it does not change under the user.
  const finish = () => {
    setAsk(null);
    void qc.invalidateQueries({ queryKey: keys.home });
  };
  const detail = useMutation({
    mutationFn: (v: { reason: string | null; comment: string }) =>
      api.send("/api/ratings", "POST", { insightKey: insight!.id, kind: insight!.kind, rating: ask, reason: v.reason, comment: v.comment }),
    onSuccess: finish,
  });

  if (!insight) {
    return (
      <Card data-tour="home-insight-of-day" className="flex h-full flex-col items-center justify-center p-8 text-center">
        <Sparkles className="size-8 text-amber-500" />
        <p className="mt-2 font-medium text-navy-900">ยังไม่มี Insight วันนี้</p>
        <p className="text-sm text-muted-foreground">เมื่อมีข้อมูล Actual ระบบจะสรุปประเด็นสำคัญให้ที่นี่</p>
      </Card>
    );
  }
  const bad = insight.metric.tone === "bad";
  const good = insight.metric.tone === "good";
  const Trend = bad ? TrendingDown : TrendingUp;
  return (
    <Card data-tour="home-insight-of-day" className="gradient-border flex h-full flex-col overflow-hidden rounded-2xl">
      <RatingFeedbackDialog
        key={ask ?? "closed"}
        rating={ask}
        insightTitle={insight.title}
        busy={detail.isPending}
        onSubmit={(reason, comment) => detail.mutate({ reason, comment })}
        onClose={finish}
      />
      <div className="flex items-center justify-between gap-2 border-b border-navy-100 bg-gradient-to-r from-navy-100/80 via-navy-50 to-white px-5 py-3.5">
        <span className="inline-flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-navy-900 to-navy-500 text-white shadow-md">
            <Sparkles className="size-[18px]" />
          </span>
          <span className="text-gradient text-xl font-bold tracking-tight">{t("home.insightOfDay")}</span>
        </span>
        <span className="text-xs text-muted-foreground">{formatDate(new Date())}</span>
      </div>
      <div className="grid flex-1 gap-5 p-5 sm:grid-cols-[13rem_1fr] sm:items-center lg:grid-cols-[15rem_1fr_22rem] lg:p-6">
        <div
          className={cn(
            "flex flex-col items-center justify-center self-stretch rounded-2xl px-5 py-6 shadow-inner",
            bad ? "bg-gradient-to-br from-rose-50 to-white text-danger ring-1 ring-rose-200/70" : good ? "bg-gradient-to-br from-emerald-50 to-white text-success ring-1 ring-emerald-200/70" : "bg-gradient-to-br from-navy-50 to-white text-navy-800 ring-1 ring-navy-200/70",
          )}
        >
          <Trend className="size-6" />
          <span className="mt-1 text-5xl font-bold tabular-nums">{insight.metric.value}</span>
          <span className="mt-1 text-center text-sm leading-tight opacity-80">{insight.metric.label}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold text-navy-900">{insight.title}</h2>
          <p className="mt-1.5 text-base text-muted-foreground">{insight.detail}</p>
          {insight.impact && (
            <p className={cn("mt-2 text-lg font-bold tabular-nums", insight.impact.tone === "bad" ? "text-danger" : "text-success")}>{insight.impact.text}</p>
          )}
        </div>
        <div className="rounded-xl border-l-4 border-navy-500 bg-gradient-to-r from-navy-50 to-transparent px-4 py-3 sm:col-span-2 lg:col-span-1">
          <div className="text-xs font-semibold tracking-wide text-navy-700">ควรทำ</div>
          <p className="mt-1 text-base leading-relaxed text-navy-900">{insight.action}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{t("home.rateQuestion")}</span>
          <button
            type="button"
            aria-label="ชอบ"
            onClick={() => rate.mutate(1)}
            className={cn("rounded-full border p-1.5 cursor-pointer", rated === 1 ? "border-success bg-success text-white" : "border-border hover:bg-success-soft hover:text-success")}
          >
            <ThumbsUp className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="ไม่ชอบ"
            onClick={() => rate.mutate(-1)}
            className={cn("rounded-full border p-1.5 cursor-pointer", rated === -1 ? "border-danger bg-danger text-white" : "border-border hover:bg-danger-soft hover:text-danger")}
          >
            <ThumbsDown className="size-3.5" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {insight.href && (
            <Link href={insight.href} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-navy-900 hover:bg-navy-50">
              {insight.hrefLabel ?? "ดูรายละเอียด"}
            </Link>
          )}
          <Link href="/insights" className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-navy-950 via-navy-800 to-navy-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition-shadow hover:shadow-lg">
            {t("home.moreInsight")} <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </Card>
  );
}

function InsightSummary({ data }: { data: HomeResponse }) {
  const g = data.groups;
  const items = [
    { key: "critical", label: "ต้องเร่งแก้ไข", icon: Siren, count: g.critical.count, amount: g.critical.amount, grad: "from-rose-500 to-red-600", soft: "from-rose-50 to-white", text: "text-danger" },
    { key: "warning", label: "ต้องเฝ้าระวัง", icon: Eye, count: g.warning.count, amount: g.warning.amount, grad: "from-amber-400 to-orange-500", soft: "from-amber-50 to-white", text: "text-warning" },
    { key: "positive", label: "เป็นไปตามแผน", icon: TrendingUp, count: g.positive.count, amount: g.positive.amount, grad: "from-emerald-500 to-teal-600", soft: "from-emerald-50 to-white", text: "text-success" },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {items.map((i, idx) => (
        <Reveal key={i.key} delay={idx * 120} variant="zoom">
          <Link
            href={`/insights#level-${i.key}`}
            className={cn("lift gradient-border group flex h-full items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-br p-5 shadow-sm", i.soft)}
          >
            {/* gradient accent bar */}
            <span className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", i.grad)} aria-hidden />
            <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg", i.grad)}>
              <i.icon className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-navy-800">{i.label}</div>
              <div className={cn("flex items-baseline gap-2", i.text)}>
                <span className="text-4xl leading-tight font-bold tabular-nums">{i.count}</span>
                <span className="text-sm">เรื่อง</span>
              </div>
              {i.amount > 0 && <div className="text-xs text-muted-foreground">มูลค่ารวม {formatMB(i.amount)} MB</div>}
            </div>
            <ArrowRight className="size-4 text-navy-300 transition-transform group-hover:translate-x-1 group-hover:text-navy-700" />
          </Link>
        </Reveal>
      ))}
    </div>
  );
}

