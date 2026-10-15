"use client";

import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  Eye,
  Info,
  Lightbulb,
  ListPlus,
  Send,
  Siren,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CreateFollowUpDialog, type FollowUpSeed } from "@/components/follow-up/create-follow-up";
import { RatingFeedbackDialog } from "@/components/insights/rating-feedback";
import { useCan, useCurrentUser, useT } from "@/components/layout/user-context";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/form";
import { InfoTip } from "@/components/ui/info-tip";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader, Spinner } from "@/components/ui/misc";
import { PageGuide } from "@/components/ui/page-guide";
import { type InsightsResponse, useInsights } from "@/hooks/queries";
import { api } from "@/lib/api";
import type { MessageKey } from "@/lib/i18n";
import { cn, formatMB } from "@/lib/utils";
import type { Insight, InsightLevel } from "@/server/insights";

const LEVELS: {
  level: InsightLevel;
  title: MessageKey;
  icon: typeof Info;
  accent: string;
  /** Icon tile + top bar gradient (same as the Home summary cards). */
  grad: string;
  /** Soft card background. */
  soft: string;
  /** Group starts collapsed (none do now; every group is open). */
  collapsed?: boolean;
}[] = [
  {
    level: "critical",
    title: "insight.critical",
    icon: Siren,
    accent: "text-danger",
    grad: "from-rose-500 to-red-600",
    soft: "from-rose-50 to-white",
  },
  {
    level: "warning",
    title: "insight.warning",
    icon: Eye,
    accent: "text-warning",
    grad: "from-amber-400 to-orange-500",
    soft: "from-amber-50 to-white",
  },
  {
    level: "positive",
    title: "insight.positive",
    icon: TrendingUp,
    accent: "text-success",
    grad: "from-emerald-500 to-teal-600",
    soft: "from-emerald-50 to-white",
  },
  { level: "info", title: "insight.info", icon: Info, accent: "text-navy-700", grad: "from-navy-800 to-navy-400", soft: "from-navy-50 to-white" },
];

/** What each box means, using the configured thresholds (MOM I3). */
function definition(level: InsightLevel, r: InsightsResponse["rules"]) {
  switch (level) {
    case "critical":
      return `รายได้ต่ำกว่าแผนสะสม (YTD) เกิน ${r.revenueCritical}% · ค่าใช้จ่ายเกินงบเกิน ${r.expenseCritical}% · รายได้ลดลงจากเดือนก่อนเกิน ${r.momDrop}% · หรือ KPI เกินเกณฑ์แจ้งเตือนที่ตั้งไว้ในแต่ละ Dashboard`;
    case "warning":
      return `รายได้ต่ำกว่าแผน ${r.revenueWarning}–${r.revenueCritical}% · ค่าใช้จ่ายเกินงบ ${r.expenseWarning}–${r.expenseCritical}% · โครงการ CAPEX ล่าช้า · Follow-up ที่เลยกำหนด`;
    case "positive":
      return `รายได้สูงกว่าแผนเกิน ${r.revenueAhead}% · หรือใช้งบต่ำกว่าแผนเกิน ${r.expenseUnder}%`;
    case "info":
      return "ข้อมูลประกอบ เช่น สัดส่วนกำไร โครงสร้างรายได้ ที่ไม่ใช่สัญญาณผิดปกติ";
  }
}

const TONE_TEXT = { bad: "text-danger", good: "text-success", neutral: "text-navy-900" } as const;
/** "Watch" insights use orange instead of red, so only the urgent group reads as red. */
const toneText = (i: Insight, tone: keyof typeof TONE_TEXT) => (tone === "bad" && i.level === "warning" ? "text-orange-600" : TONE_TEXT[tone]);
/** Soft level background for the detail cards (no top bar there). */
const SOFT = Object.fromEntries(LEVELS.map((l) => [l.level, l.soft])) as Record<InsightLevel, string>;

export default function InsightsPage() {
  const t = useT();
  const user = useCurrentUser();
  const { data, isLoading, error } = useInsights();
  // Every group starts open; the user can still collapse one.
  const [open, setOpen] = useState<Record<InsightLevel, boolean>>(() => ({
    critical: true,
    warning: true,
    positive: true,
    info: true,
  }));
  const [seed, setSeed] = useState<FollowUpSeed | null>(null);
  const insights = data?.insights ?? [];
  // Personal order (stable): an insight the user liked comes first, one they disliked goes last,
  // and kinds they tend to like / dislike move up / down. Applied on load, so cards do not jump on click.
  const score = (i: Insight) => (data?.myRatings?.[i.id] ?? 0) * 10 + Math.max(-5, Math.min(5, data?.kindPrefs?.[i.kind] ?? 0));
  const byLevel = (l: InsightLevel) =>
    insights
      .filter((i) => i.level === l)
      .map((i, idx) => ({ i, idx, s: score(i) }))
      .sort((a, b) => b.s - a.s || a.idx - b.idx)
      .map((x) => x.i);

  const jump = (level: InsightLevel) => {
    setOpen((o) => ({ ...o, [level]: true }));
    requestAnimationFrame(() => document.getElementById(`level-${level}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <>
      <PageHeader icon={Lightbulb} tone="amber" title={t("insight.title")} description={t("insight.subtitle")} />
      <PageGuide
        id="insights"
        title="อ่าน Insight อย่างไร"
        steps={[
          "กล่องด้านบนสรุปจำนวนเรื่องและมูลค่าเงินในแต่ละกลุ่ม — ชี้ที่ ⓘ เพื่อดูเกณฑ์",
          "คลิกตัวเลขบนการ์ด เพื่อเปิด Dashboard ที่เกี่ยวข้อง (กรองและเลื่อนไปยังกราฟให้อัตโนมัติ)",
          "กด “สร้าง Follow-up” เพื่อมอบหมายผู้รับผิดชอบและติดตามผล",
          "ถามเพิ่มเติมกับ FINLEY ได้จากปุ่มลอยมุมจอ",
        ]}
      />

      {data?.scope && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-navy-900">
            <CalendarRange className="size-4 text-navy-600" /> {t("insight.scope")}: <b>{data.scope.label}</b>
          </span>
          <span className="rounded-full border border-border bg-white px-3 py-1 text-xs text-muted-foreground">
            {user.departments ? `เฉพาะ ${user.departments.length} หน่วยงานที่คุณดูได้` : "ทุกหน่วยงาน"} · เทียบแผนแบบสะสม (YTD)
          </span>
        </div>
      )}

      {isLoading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock error={error} />
      ) : !data || insights.length === 0 ? (
        <EmptyState title="ยังไม่มีสัญญาณ">อัปโหลดข้อมูลการเงินเพื่อให้ระบบวิเคราะห์</EmptyState>
      ) : (
        <>
          <div data-tour="insight-groups" className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {LEVELS.map((s) => {
              const g = data.groups[s.level];
              return (
                <div
                  key={s.level}
                  className={cn(
                    "gradient-border lift group overflow-hidden rounded-2xl bg-gradient-to-br shadow-sm",
                    s.soft,
                    g.count === 0 && "opacity-60",
                  )}
                >
                  {/* gradient accent bar (summary cards only) */}
                  <span className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", s.grad)} aria-hidden />
                  <InfoTip align="end" className={cn("absolute top-3 right-3 z-10", s.accent)}>
                    {definition(s.level, data.rules)}
                  </InfoTip>
                  <button
                    type="button"
                    onClick={() => jump(s.level)}
                    className="flex h-full w-full items-center gap-3 p-4 pr-8 text-left cursor-pointer"
                  >
                    <span
                      className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg", s.grad)}
                    >
                      <s.icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm leading-snug font-medium text-navy-800">{t(s.title)}</span>
                      <span className={cn("flex items-baseline gap-1.5", g.count ? s.accent : "text-muted-foreground")}>
                        <span className="text-3xl leading-tight font-bold tabular-nums">{g.count}</span>
                        <span className="text-sm">เรื่อง</span>
                      </span>
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        {g.amount > 0 ? `มูลค่ารวม ${s.level === "positive" ? "+" : ""}${formatMB(g.amount)} MB` : "—"}
                      </span>
                    </span>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="space-y-8">
            {LEVELS.filter((s) => byLevel(s.level).length > 0).map((s) => {
              const list = byLevel(s.level);
              const isOpen = open[s.level];
              return (
                <section key={s.level} id={`level-${s.level}`} className="scroll-mt-20">
                  <button
                    type="button"
                    onClick={() => setOpen((o) => ({ ...o, [s.level]: !o[s.level] }))}
                    aria-expanded={isOpen}
                    className="mb-3 flex w-full items-center gap-3 border-b border-border pb-2 text-left cursor-pointer"
                  >
                    <h2 className={cn("flex items-center gap-2 text-lg font-bold", s.accent)}>
                      <s.icon className="size-5" /> {t(s.level === "warning" ? "insight.warningSection" : s.title)}
                    </h2>
                    <span className="text-sm text-muted-foreground">
                      {list.length} เรื่อง
                      {data.groups[s.level].amount > 0 && ` · ${formatMB(data.groups[s.level].amount)} MB`}
                    </span>
                    <ChevronDown className={cn("ml-auto size-5 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                  </button>
                  {!isOpen ? (
                    <p className="text-sm text-muted-foreground">
                      ซ่อนไว้ — คลิกหัวข้อเพื่อดู {list.length} เรื่อง{s.collapsed ? " (เฝ้าระวัง ยังไม่ถึงขั้นต้องรีบแก้)" : ""}
                    </p>
                  ) : s.level === "positive" || s.level === "info" ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {list.map((i) => (
                        <CompactCard key={i.id} insight={i} rating={data.myRatings?.[i.id] ?? 0} />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {list.map((i) => (
                        <ActionCard key={i.id} insight={i} rating={data.myRatings?.[i.id] ?? 0} onFollowUp={setSeed} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <div className="mt-10">
            <RequestInsight />
          </div>
        </>
      )}
      <CreateFollowUpDialog seed={seed} onClose={() => setSeed(null)} />
    </>
  );
}

/** Big number links to the related dashboard, filtered and scrolled to the chart (MOM I6). */
function MetricLink({ insight: i, size }: { insight: Insight; size: "lg" | "md" }) {
  const inner = (
    <>
      <span className={cn("block font-bold leading-none tabular-nums", size === "lg" ? "text-4xl" : "text-3xl", toneText(i, i.metric.tone))}>
        {i.metric.value}
      </span>
      <span className="mt-2 block text-xs font-medium text-muted-foreground">{i.metric.label}</span>
    </>
  );
  if (!i.href) return <div>{inner}</div>;
  return (
    <Link
      href={i.href}
      title={i.hrefLabel ?? "ดูที่ Dashboard"}
      className="group block rounded-md hover:underline decoration-dotted underline-offset-4"
    >
      {inner}
      <span className="mt-1 inline-flex items-center gap-0.5 text-xs text-navy-700 opacity-0 transition-opacity group-hover:opacity-100">
        เปิด Dashboard <ArrowRight className="size-3" />
      </span>
    </Link>
  );
}

function ActionCard({ insight: i, rating, onFollowUp }: { insight: Insight; rating: 1 | -1 | 0; onFollowUp: (s: FollowUpSeed) => void }) {
  const critical = i.level === "critical";
  return (
    <article
      className={cn("gradient-border grid overflow-hidden rounded-2xl bg-gradient-to-br shadow-sm md:grid-cols-[180px_1fr_300px]", SOFT[i.level])}
    >
      <div
        className={cn("flex flex-col justify-center border-b px-5 py-4 md:border-r md:border-b-0", critical ? "border-danger/15" : "border-border")}
      >
        <MetricLink insight={i} size="lg" />
      </div>
      <div className="relative flex flex-col px-5 py-4">
        <div className="absolute top-2.5 right-3">
          <CardRating insight={i} initial={rating} />
        </div>
        <h3 className="pr-32 text-base font-semibold text-navy-900">{i.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{i.detail}</p>
        {i.impact && <p className={cn("mt-2 text-lg font-bold tabular-nums", toneText(i, i.impact.tone))}>{i.impact.text}</p>}
      </div>
      <div className="flex flex-col gap-3 border-t border-border bg-white/60 px-5 py-4 md:border-t-0 md:border-l">
        <div>
          <div className="text-xs font-semibold tracking-wide text-navy-700 uppercase">สิ่งที่ควรทำ</div>
          <p className="mt-1 text-sm leading-relaxed font-medium text-navy-900">{i.action}</p>
        </div>
        <div className="mt-auto flex flex-wrap gap-2">
          <FollowUpButton insight={i} onFollowUp={onFollowUp} />
          {i.href && (
            <Link href={i.href} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {i.hrefLabel ?? "ดูรายละเอียด"} <ArrowRight />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function CompactCard({ insight: i, rating }: { insight: Insight; rating: 1 | -1 | 0 }) {
  return (
    <article className={cn("gradient-border flex gap-4 rounded-2xl bg-gradient-to-br p-4 shadow-sm", SOFT[i.level])}>
      <div className="absolute top-2.5 right-3 z-10">
        <CardRating insight={i} initial={rating} compact />
      </div>
      <div className="w-28 shrink-0">
        <MetricLink insight={i} size="md" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="pr-14 font-semibold text-navy-900">{i.title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{i.detail}</p>
        {i.impact && <p className={cn("mt-1.5 text-sm font-bold tabular-nums", toneText(i, i.impact.tone))}>{i.impact.text}</p>}
        <p className="mt-2 flex gap-1.5 text-xs text-navy-800">
          <ArrowRight className="mt-0.5 size-3 shrink-0" /> {i.action}
        </p>
      </div>
    </article>
  );
}

function FollowUpButton({ insight: i, onFollowUp }: { insight: Insight; onFollowUp: (s: FollowUpSeed) => void }) {
  const canFollow = useCan("issues.create");
  if (!i.issue) return null;
  if (i.trackedIssueId) {
    return (
      <Link
        href={`/follow-up?id=${i.trackedIssueId}`}
        className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-success hover:underline"
      >
        <CheckCircle2 className="size-4" /> มี Follow-up ติดตามแล้ว
      </Link>
    );
  }
  if (!canFollow) return null;
  return (
    <Button
      size="sm"
      data-tour="insight-follow-up"
      onClick={() =>
        onFollowUp({
          ...i.issue!,
          sourceInsightId: i.id,
          metricLabel: i.metric.label,
          baselineValue: Math.round(i.metric.raw * 10) / 10,
        })
      }
    >
      <ListPlus /> สร้าง Follow-up
    </Button>
  );
}

/** MOM I7 — does this page help? */
/** Like / dislike on each insight card (feeds the Insight of the Day ranking, MOM H3). */
function CardRating({ insight: i, initial, compact = false }: { insight: Insight; initial: 1 | -1 | 0; compact?: boolean }) {
  const t = useT();
  const [rated, setRated] = useState<1 | -1 | 0>(initial);
  const [ask, setAsk] = useState<1 | -1 | null>(null);
  const rate = useMutation({
    mutationFn: (rating: 1 | -1) => api.send("/api/ratings", "POST", { insightKey: i.id, kind: i.kind, rating }),
    onMutate: (rating) => {
      const before = rated;
      setRated(rating);
      return before;
    },
    // Saved; now ask (optionally) why.
    onSuccess: (_d, rating) => setAsk(rating),
    onError: (_e, _r, before) => setRated(before ?? 0),
  });
  const detail = useMutation({
    mutationFn: (v: { reason: string | null; comment: string }) =>
      api.send("/api/ratings", "POST", { insightKey: i.id, kind: i.kind, rating: ask, reason: v.reason, comment: v.comment }),
    onSuccess: () => setAsk(null),
  });
  const btn = "inline-flex size-6 items-center justify-center rounded-full border transition-colors cursor-pointer disabled:cursor-wait";
  return (
    <>
      <RatingFeedbackDialog
        key={ask ?? "closed"}
        rating={ask}
        insightTitle={i.title}
        busy={detail.isPending}
        onSubmit={(reason, comment) => detail.mutate({ reason, comment })}
        onClose={() => setAsk(null)}
      />
      <div role="group" aria-label="Insight นี้ตอบโจทย์ไหม" className="flex items-center gap-1">
        {!compact && <span className="mr-0.5 text-[11px] text-muted-foreground">ตอบโจทย์ไหม?</span>}
        <button
          type="button"
          aria-pressed={rated === 1}
          aria-label={t("insight.helpful")}
          title={t("insight.helpful")}
          disabled={rate.isPending}
          onClick={() => rate.mutate(1)}
          className={cn(
            btn,
            rated === 1 ? "border-success bg-success text-white" : "border-border bg-white text-navy-700 hover:bg-success-soft hover:text-success",
          )}
        >
          <ThumbsUp className="size-3" />
        </button>
        <button
          type="button"
          aria-pressed={rated === -1}
          aria-label={t("insight.notHelpful")}
          title={t("insight.notHelpful")}
          disabled={rate.isPending}
          onClick={() => rate.mutate(-1)}
          className={cn(
            btn,
            rated === -1 ? "border-danger bg-danger text-white" : "border-border bg-white text-navy-700 hover:bg-danger-soft hover:text-danger",
          )}
        >
          <ThumbsDown className="size-3" />
        </button>
      </div>
    </>
  );
}

/** MOM I8 — ask for more insights; lands in Feedback for the team. */
function RequestInsight() {
  const t = useT();
  const [text, setText] = useState("");
  const send = useMutation({
    mutationFn: () => api.send("/api/feedback", "POST", { type: "insight_request", title: text.slice(0, 120), detail: text, page: "/insights" }),
    onSuccess: () => setText(""),
  });
  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-navy-900">{t("insight.requestTitle")}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">เช่น “อยากเห็นหลักสูตรที่ขาดทุนติดต่อกัน 3 เดือน”</p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim().length >= 2) send.mutate();
        }}
      >
        <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-10 flex-1" rows={2} />
        <Button type="submit" className="self-end" disabled={send.isPending || text.trim().length < 2}>
          {send.isPending ? <Spinner className="text-white" /> : <Send />} ส่ง
        </Button>
      </form>
      {send.isSuccess && <p className="mt-2 text-xs text-success">ส่งคำขอแล้ว ติดตามสถานะได้ที่เมนู “แจ้งปัญหา / ข้อเสนอแนะ”</p>}
    </Card>
  );
}
