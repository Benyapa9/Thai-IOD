"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Clock, ListChecks, type LucideIcon, Plus, Trash2, TrendingUp, UserRound } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { CreateFollowUpDialog, type FollowUpSeed } from "@/components/follow-up/create-follow-up";
import { useCan, useCurrentUser } from "@/components/layout/user-context";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { EmptyState, ErrorBlock, IconBadge, type IconTone, LoadingBlock, PageHeader, SegmentedControl, Spinner } from "@/components/ui/misc";
import { PageGuide } from "@/components/ui/page-guide";
import { SortTh, useSort } from "@/components/ui/sortable";
import { Td } from "@/components/ui/table";
import { type ClientIssue, useInsights, useIssues, useUsers } from "@/hooks/queries";
import { api } from "@/lib/api";
import { ISSUE_STATUS_LABEL, OUTCOME_RESULT_LABEL, SEVERITY_LABEL } from "@/lib/labels";
import { cn, formatDate } from "@/lib/utils";
import { ISSUE_STATUSES, OUTCOME_RESULTS, type IssueStatus, type OutcomeResult, type Severity } from "@/types/domain";

const SEVERITY_VARIANT: Record<Severity, BadgeVariant> = { critical: "danger", high: "danger", medium: "warning", low: "muted" };
const STATUS_VARIANT: Record<IssueStatus, BadgeVariant> = { open: "default", in_progress: "warning", resolved: "success", closed: "muted" };
const OUTCOME_VARIANT: Record<OutcomeResult, BadgeVariant> = { pending: "muted", improved: "success", not_improved: "danger" };
const SEVERITY_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

type View = "active" | "mine" | "done" | "all";

const isOpen = (i: ClientIssue) => i.status === "open" || i.status === "in_progress";
const isOverdue = (i: ClientIssue) => isOpen(i) && !!i.dueDate && new Date(i.dueDate) < new Date(new Date().toDateString());

export default function FollowUpPage() {
  const params = useSearchParams();
  const me = useCurrentUser();
  const canEdit = useCan("issues.create");
  const { data: issues = [], isLoading, error } = useIssues();
  const { data: users = [] } = useUsers();
  const insights = useInsights();
  const [view, setView] = useState<View>(params.get("mine") ? "mine" : "active");
  const [openId, setOpenId] = useState<string | null>(params.get("id"));
  const [seed, setSeed] = useState<FollowUpSeed | null>(null);

  const nameOf = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);
  /** Latest value of the metric each follow-up came from (for "before vs now", MOM F2). */
  const currentOf = useMemo(() => new Map((insights.data?.insights ?? []).map((i) => [i.id, i.metric.raw])), [insights.data]);

  const rows = useMemo(
    () =>
      issues.filter((i) =>
        view === "active" ? isOpen(i) : view === "mine" ? i.ownerId === me.id && isOpen(i) : view === "done" ? !isOpen(i) : true,
      ),
    [issues, view, me.id],
  );
  const { sorted, sort, toggle } = useSort(
    rows,
    {
      title: (i) => i.title,
      severity: (i) => SEVERITY_RANK[i.severity],
      owner: (i) => (i.ownerId ? nameOf.get(i.ownerId) : null),
      due: (i) => (i.dueDate ? +new Date(i.dueDate) : null),
      status: (i) => ISSUE_STATUSES.indexOf(i.status),
      outcome: (i) => OUTCOME_RESULTS.indexOf(i.outcomeResult),
    },
    { key: "due", dir: "asc" },
  );

  const stats = {
    open: issues.filter(isOpen).length,
    overdue: issues.filter(isOverdue).length,
    mine: issues.filter((i) => i.ownerId === me.id && isOpen(i)).length,
    improved: issues.filter((i) => i.outcomeResult === "improved").length,
  };
  const selected = issues.find((i) => i.id === openId) ?? null;

  return (
    <div>
      <PageHeader
        icon={ListChecks}
        tone="teal"
        title="Follow-up Actions"
        description="ติดตามการแก้ไขประเด็นทางการเงินที่พบจาก Insight — แผน แนวทาง ผู้รับผิดชอบ และผลลัพธ์"
        actions={
          canEdit && (
            <Button onClick={() => setSeed({ title: "" })}>
              <Plus /> สร้าง Follow-up
            </Button>
          )
        }
      />
      <PageGuide
        id="follow-up"
        title="Follow-up Actions ใช้ทำอะไร"
        steps={[
          "สร้างจากปุ่ม “สร้าง Follow-up” บนการ์ด Insight หรือสร้างเองที่นี่",
          "คลิกรายการเพื่อกรอกแผน แนวทาง ผู้รับผิดชอบ และวันครบกำหนด",
          "เมื่อถึงกำหนด ระบบแสดงค่าตั้งต้นเทียบค่าล่าสุด เพื่อประเมินว่าดีขึ้นหรือไม่",
          "ปัญหาการใช้งานระบบ ให้แจ้งที่เมนู “แจ้งปัญหา / ข้อเสนอแนะ” แทน",
        ]}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="กำลังติดตาม" value={stats.open} tone="navy" icon={Clock} iconTone="blue" />
        <Stat label="เลยกำหนด" value={stats.overdue} tone={stats.overdue ? "danger" : "navy"} icon={AlertTriangle} iconTone="red" />
        <Stat label="ของฉัน" value={stats.mine} tone="navy" icon={UserRound} iconTone="violet" />
        <Stat label="ผลดีขึ้นแล้ว" value={stats.improved} tone="success" icon={TrendingUp} iconTone="green" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SegmentedControl<View>
          value={view}
          onChange={setView}
          options={[
            { value: "active", label: "กำลังติดตาม" },
            { value: "mine", label: "ของฉัน" },
            { value: "done", label: "ปิดแล้ว" },
            { value: "all", label: "ทั้งหมด" },
          ]}
        />
      </div>

      {isLoading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock error={error} />
      ) : !sorted.length ? (
        <EmptyState title="ไม่มีรายการ">ลองเปลี่ยนมุมมอง หรือสร้าง Follow-up จากหน้า Insight</EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <SortTh label="หัวข้อ" sortKey="title" sort={sort} onSort={toggle} />
                  <SortTh label="ความเร่งด่วน" sortKey="severity" sort={sort} onSort={toggle} />
                  <SortTh label="ผู้รับผิดชอบ" sortKey="owner" sort={sort} onSort={toggle} />
                  <SortTh label="ครบกำหนด" sortKey="due" sort={sort} onSort={toggle} />
                  <SortTh label="สถานะ" sortKey="status" sort={sort} onSort={toggle} />
                  <SortTh label="ผลลัพธ์" sortKey="outcome" sort={sort} onSort={toggle} />
                </tr>
              </thead>
              <tbody>
                {sorted.map((i) => (
                  <tr key={i.id} onClick={() => setOpenId(i.id)} className="cursor-pointer hover:bg-navy-50/60">
                    <Td className="max-w-md">
                      <div className="font-medium text-navy-900">{i.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{i.plan ? `แผน: ${i.plan}` : "ยังไม่ได้กรอกแผน — คลิกเพื่อเพิ่ม"}</div>
                    </Td>
                    <Td>
                      <Badge variant={SEVERITY_VARIANT[i.severity]}>{SEVERITY_LABEL[i.severity]}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap">{i.ownerId ? nameOf.get(i.ownerId) ?? "-" : <span className="text-muted-foreground">ยังไม่ระบุ</span>}</Td>
                    <Td className={cn("whitespace-nowrap", isOverdue(i) && "font-semibold text-danger")}>
                      {isOverdue(i) && <AlertTriangle className="mr-1 inline size-3.5" />}
                      {formatDate(i.dueDate)}
                    </Td>
                    <Td>
                      <Badge variant={STATUS_VARIANT[i.status]}>{ISSUE_STATUS_LABEL[i.status]}</Badge>
                    </Td>
                    <Td>
                      <Badge variant={OUTCOME_VARIANT[i.outcomeResult]}>{OUTCOME_RESULT_LABEL[i.outcomeResult]}</Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {selected && (
        <FollowUpDetail
          key={selected.id}
          issue={selected}
          current={selected.sourceInsightId ? currentOf.get(selected.sourceInsightId) : undefined}
          users={users.filter((u) => u.isActive).map((u) => ({ id: u.id, name: u.name }))}
          reporterName={nameOf.get(selected.reporter) ?? "-"}
          onClose={() => setOpenId(null)}
        />
      )}
      <CreateFollowUpDialog seed={seed} onClose={() => setSeed(null)} />
    </div>
  );
}

function Stat({ label, value, tone, icon, iconTone }: { label: string; value: number; tone: "navy" | "danger" | "success"; icon: LucideIcon; iconTone: IconTone }) {
  return (
    <Card className={cn("flex items-center gap-3 p-4", tone === "danger" && "border-danger/30 bg-danger-soft", tone === "success" && "border-success/30 bg-success-soft")}>
      <IconBadge icon={icon} tone={iconTone} size="lg" />
      <div>
        <div className="text-[13px] text-muted-foreground">{label}</div>
        <div className={cn("text-2xl leading-tight font-bold tabular-nums", tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-navy-900")}>{value}</div>
      </div>
    </Card>
  );
}

/** MOM F2 — click an item: plan, approach, due date, owner, status and outcome vs baseline. */
function FollowUpDetail({
  issue,
  current,
  users,
  reporterName,
  onClose,
}: {
  issue: ClientIssue;
  current: number | undefined;
  users: { id: string; name: string }[];
  reporterName: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const canEdit = useCan("issues.update");
  const canDelete = useCan("issues.delete");
  const [form, setForm] = useState({
    plan: issue.plan ?? "",
    approach: issue.approach ?? "",
    ownerId: issue.ownerId ?? "",
    dueDate: issue.dueDate ? issue.dueDate.slice(0, 10) : "",
    status: issue.status,
    outcome: issue.outcome ?? "",
    outcomeResult: issue.outcomeResult,
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => api.send(`/api/issues/${issue.id}`, "PATCH", { ...form, ownerId: form.ownerId || null, dueDate: form.dueDate || null }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["issues"] });
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.send(`/api/issues/${issue.id}`, "DELETE"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["issues"] });
      onClose();
    },
  });

  const due = issue.dueDate ? new Date(issue.dueDate) : null;
  const reachedDue = !!due && due <= new Date();
  const delta = issue.baselineValue !== null && current !== undefined ? current - issue.baselineValue : null;

  return (
    <Dialog open onClose={onClose} title="รายละเอียด Follow-up" className="max-w-3xl">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-navy-900">{issue.title}</h3>
          <p className="text-xs text-muted-foreground">
            สร้างโดย {reporterName} · {formatDate(issue.createdAt)} · ความเร่งด่วน {SEVERITY_LABEL[issue.severity]}
          </p>
          {issue.description && <p className="mt-2 text-sm text-navy-800">{issue.description}</p>}
        </div>

        {issue.metricLabel && issue.baselineValue !== null && (
          <div className="grid gap-2 rounded-lg border border-border bg-navy-50/50 p-3 sm:grid-cols-3">
            <div>
              <div className="text-xs text-muted-foreground">ค่าตั้งต้น ({formatDate(issue.createdAt)})</div>
              <div className="text-xl font-bold text-navy-900 tabular-nums">{issue.baselineValue.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">{issue.metricLabel}</div>
            </div>
            <div className="flex items-center justify-center text-muted-foreground">
              <ArrowRight className="size-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">ค่าล่าสุด {reachedDue ? "(ถึงกำหนดแล้ว)" : ""}</div>
              {current !== undefined ? (
                <div className="text-xl font-bold tabular-nums text-navy-900">
                  {current.toFixed(1)}{" "}
                  {delta !== null && (
                    <span className={cn("text-sm", Math.abs(delta) < 0.05 ? "text-muted-foreground" : Math.abs(current) < Math.abs(issue.baselineValue) ? "text-success" : "text-danger")}>
                      ({delta > 0 ? "+" : ""}
                      {delta.toFixed(1)})
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1 text-sm font-medium text-success">
                  <CheckCircle2 className="size-4" /> ไม่พบสัญญาณนี้แล้ว (กลับเข้าเกณฑ์)
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="d-plan">แผนการแก้ไข</Label>
            <Textarea id="d-plan" disabled={!canEdit} value={form.plan} onChange={(e) => set("plan", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="d-appr">แนวทาง / วิธีการ</Label>
            <Textarea id="d-appr" disabled={!canEdit} value={form.approach} onChange={(e) => set("approach", e.target.value)} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="d-owner">ผู้รับผิดชอบ</Label>
            <Select id="d-owner" disabled={!canEdit} value={form.ownerId} onChange={(e) => set("ownerId", e.target.value)}>
              <option value="">— ยังไม่ระบุ —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="d-due">
              <CalendarClock className="mr-1 inline size-3.5" />
              วันครบกำหนด
            </Label>
            <Input id="d-due" type="date" disabled={!canEdit} value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="d-status">สถานะ</Label>
            <Select id="d-status" disabled={!canEdit} value={form.status} onChange={(e) => set("status", e.target.value as IssueStatus)}>
              {ISSUE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ISSUE_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="mb-2 text-sm font-medium text-navy-900">ผลลัพธ์เมื่อถึงกำหนด</p>
          <div className="mb-2 flex flex-wrap gap-2">
            {OUTCOME_RESULTS.map((r) => (
              <label key={r} className={cn("relative flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs", form.outcomeResult === r ? "border-navy-700 bg-navy-900 text-white" : "border-border")}>
                <input type="radio" className="sr-only" disabled={!canEdit} checked={form.outcomeResult === r} onChange={() => set("outcomeResult", r)} />
                {OUTCOME_RESULT_LABEL[r]}
              </label>
            ))}
          </div>
          <Textarea disabled={!canEdit} value={form.outcome} onChange={(e) => set("outcome", e.target.value)} placeholder="สรุปผล เช่น รายได้ฟื้นกลับมาใกล้แผน / ต้องขยายเวลา" className="min-h-16" />
        </div>
        {(save.error || remove.error) && <p className="text-sm text-danger">{((save.error ?? remove.error) as Error).message}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            {issue.sourceInsightId && (
              <Link href="/insights" className="text-xs text-navy-700 hover:underline">
                ดู Insight ต้นทาง
              </Link>
            )}
          </div>
          <div className="flex gap-2">
            {canDelete && (
              <Button variant="ghost" className="text-danger" onClick={() => confirm("ลบรายการนี้?") && remove.mutate()} disabled={remove.isPending}>
                <Trash2 /> ลบ
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              ปิด
            </Button>
            {canEdit && (
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending && <Spinner className="text-white" />} บันทึก
              </Button>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
