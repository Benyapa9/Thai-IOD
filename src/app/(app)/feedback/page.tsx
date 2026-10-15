"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bug, Lightbulb, MessageSquareHeart, MessageSquareWarning, Send, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useCan } from "@/components/layout/user-context";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { EmptyState, ErrorBlock, IconBadge, LoadingBlock, PageHeader, Spinner } from "@/components/ui/misc";
import { PageGuide } from "@/components/ui/page-guide";
import { SortTh, useSort } from "@/components/ui/sortable";
import { Td } from "@/components/ui/table";
import { useFeedback } from "@/hooks/queries";
import { api } from "@/lib/api";
import { FEEDBACK_STATUS_LABEL, FEEDBACK_TYPE_LABEL } from "@/lib/labels";
import { SECTIONS } from "@/lib/sections";
import { cn, formatDate } from "@/lib/utils";
import { FEEDBACK_STATUSES, FEEDBACK_TYPES, type FeedbackStatus, type FeedbackType } from "@/types/domain";

const TYPE_ICON: Record<FeedbackType, typeof Bug> = {
  issue: Bug,
  new_request: Sparkles,
  insight_request: Lightbulb,
  page_feedback: MessageSquareHeart,
};
const STATUS_VARIANT: Record<FeedbackStatus, BadgeVariant> = { open: "default", in_review: "warning", done: "success" };

export default function FeedbackPage() {
  const params = useSearchParams();
  const manage = useCan("feedback.manage");
  const [tab, setTab] = useState<FeedbackType | "all">("all");
  const { data: items = [], isLoading, error } = useFeedback();
  const qc = useQueryClient();

  const rows = useMemo(() => items.filter((i) => tab === "all" || i.type === tab), [items, tab]);
  const { sorted, sort, toggle } = useSort(
    rows,
    {
      type: (i) => FEEDBACK_TYPE_LABEL[i.type],
      title: (i) => i.title,
      by: (i) => i.createdByName ?? "",
      date: (i) => +new Date(i.createdAt),
      status: (i) => FEEDBACK_STATUSES.indexOf(i.status),
    },
    { key: "date", dir: "desc" },
  );
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: FeedbackStatus }) => api.send(`/api/feedback/${id}`, "PATCH", { status }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["feedback"] }),
  });

  const initialType = params.get("type");
  return (
    <div>
      <PageHeader icon={MessageSquareWarning} tone="pink" title="แจ้งปัญหา / ข้อเสนอแนะ" description="แจ้งปัญหาการใช้งานระบบ หรือขอฟีเจอร์ / Dashboard ใหม่ — แยกจาก Follow-up Actions ซึ่งใช้ติดตามประเด็นทางการเงิน" />
      <PageGuide
        id="feedback"
        title="ส่งเรื่องถึงทีมพัฒนาได้ที่นี่"
        steps={[
          "เลือกประเภท: Issue (ระบบมีปัญหา) หรือ New Request (อยากได้สิ่งใหม่)",
          "อธิบายสิ่งที่พบ ระบุหน้าที่เกี่ยวข้องเพื่อให้ตรวจสอบได้เร็ว",
          "ติดตามสถานะเรื่องที่ส่งได้ในตารางด้านล่าง",
          manage ? "คุณเป็น Advanced User — เห็นเรื่องของทุกคนและเปลี่ยนสถานะได้" : "คุณเห็นเฉพาะเรื่องที่ตัวเองส่ง",
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <NewFeedbackForm key={initialType ?? "issue"} initialType={initialType === "new_request" ? "new_request" : "issue"} initialPage={params.get("page") ?? ""} />

        <div className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {(["all", ...FEEDBACK_TYPES] as const).map((t) => {
              const count = t === "all" ? items.length : items.filter((i) => i.type === t).length;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium cursor-pointer",
                    tab === t ? "border-navy-900 bg-navy-900 text-white" : "border-border bg-white text-navy-800 hover:bg-navy-50",
                  )}
                >
                  {t === "all" ? "ทั้งหมด" : FEEDBACK_TYPE_LABEL[t]} ({count})
                </button>
              );
            })}
          </div>
          {isLoading ? (
            <LoadingBlock />
          ) : error ? (
            <ErrorBlock error={error} />
          ) : !sorted.length ? (
            <EmptyState title="ยังไม่มีเรื่องในหมวดนี้" />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <SortTh label="ประเภท" sortKey="type" sort={sort} onSort={toggle} />
                      <SortTh label="เรื่อง" sortKey="title" sort={sort} onSort={toggle} />
                      {manage && <SortTh label="ผู้ส่ง" sortKey="by" sort={sort} onSort={toggle} />}
                      <SortTh label="วันที่" sortKey="date" sort={sort} onSort={toggle} />
                      <SortTh label="สถานะ" sortKey="status" sort={sort} onSort={toggle} />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((i) => {
                      const Icon = TYPE_ICON[i.type];
                      return (
                        <tr key={i.id} className="align-top">
                          <Td className="whitespace-nowrap text-xs">
                            <Icon className="mr-1 inline size-3.5 text-navy-600" />
                            {FEEDBACK_TYPE_LABEL[i.type]}
                          </Td>
                          <Td>
                            <div className="flex items-center gap-1.5 font-medium text-navy-900">
                              {i.rating === "helpful" && <ThumbsUp className="size-3.5 text-success" />}
                              {i.rating === "not_helpful" && <ThumbsDown className="size-3.5 text-danger" />}
                              {i.title}
                            </div>
                            {i.detail && <p className="mt-0.5 line-clamp-3 text-xs text-muted-foreground">{i.detail}</p>}
                            {i.page && <p className="mt-0.5 text-xs text-navy-600">หน้า: {i.page}</p>}
                          </Td>
                          {manage && <Td className="whitespace-nowrap text-xs">{i.createdByName}</Td>}
                          <Td className="whitespace-nowrap text-xs">{formatDate(i.createdAt)}</Td>
                          <Td>
                            {manage ? (
                              <Select
                                value={i.status}
                                className="h-8 w-36 text-xs"
                                onChange={(e) => setStatus.mutate({ id: i.id, status: e.target.value as FeedbackStatus })}
                              >
                                {FEEDBACK_STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {FEEDBACK_STATUS_LABEL[s]}
                                  </option>
                                ))}
                              </Select>
                            ) : (
                              <Badge variant={STATUS_VARIANT[i.status]}>{FEEDBACK_STATUS_LABEL[i.status]}</Badge>
                            )}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function NewFeedbackForm({ initialType, initialPage }: { initialType: "issue" | "new_request"; initialPage: string }) {
  const qc = useQueryClient();
  const [type, setType] = useState<"issue" | "new_request">(initialType);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [page, setPage] = useState(initialPage);
  const [sent, setSent] = useState(false);
  const send = useMutation({
    mutationFn: () => api.send("/api/feedback", "POST", { type, title, detail, page }),
    onSuccess: () => {
      setTitle("");
      setDetail("");
      setSent(true);
      void qc.invalidateQueries({ queryKey: ["feedback"] });
    },
  });

  return (
    <Card className="h-fit p-5">
      <h2 className="flex items-center gap-2.5 text-base font-semibold text-navy-900">
        <IconBadge icon={Send} tone="pink" size="sm" /> ส่งเรื่องใหม่
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(
          [
            { key: "issue", label: "Issue", hint: "ระบบผิดพลาด / ใช้งานไม่ได้", icon: Bug, cls: "border-danger bg-danger-soft text-danger" },
            { key: "new_request", label: "New Request", hint: "ขอฟีเจอร์ / รายงานใหม่", icon: Sparkles, cls: "border-sky-600 bg-sky-50 text-sky-700" },
          ] as const
        ).map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => setType(o.key)}
            className={cn("rounded-lg border p-3 text-left cursor-pointer", type === o.key ? o.cls : "border-border hover:bg-navy-50")}
          >
            <o.icon className="size-4" />
            <div className="mt-1 text-sm font-semibold">{o.label}</div>
            <div className="text-xs opacity-80">{o.hint}</div>
          </button>
        ))}
      </div>
      <form
        className="mt-3 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setSent(false);
          send.mutate();
        }}
      >
        <div>
          <Label htmlFor="fb-title">หัวข้อ</Label>
          <Input id="fb-title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} />
        </div>
        <div>
          <Label htmlFor="fb-detail">{type === "issue" ? "เกิดอะไรขึ้น / ทำอะไรอยู่ตอนนั้น" : "อยากได้อะไร และจะนำไปใช้อย่างไร"}</Label>
          <Textarea id="fb-detail" value={detail} onChange={(e) => setDetail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="fb-page">หน้าที่เกี่ยวข้อง</Label>
          <Select id="fb-page" value={page} onChange={(e) => setPage(e.target.value)}>
            <option value="">— ไม่ระบุ —</option>
            {Object.values(SECTIONS).map((s) => (
              <option key={s.href} value={s.href}>
                {s.label.th}
              </option>
            ))}
            {page && !Object.values(SECTIONS).some((s) => s.href === page) && <option value={page}>{page}</option>}
          </Select>
        </div>
        {send.error && <p className="text-sm text-danger">{(send.error as Error).message}</p>}
        {sent && <p className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">ส่งเรื่องเรียบร้อย ขอบคุณสำหรับความคิดเห็น</p>}
        <Button type="submit" className="w-full" disabled={send.isPending || title.trim().length < 2}>
          {send.isPending && <Spinner className="text-white" />} ส่งเรื่อง
        </Button>
      </form>
    </Card>
  );
}
