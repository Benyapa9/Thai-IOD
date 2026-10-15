"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/form";
import { Spinner } from "@/components/ui/misc";
import { useUsers } from "@/hooks/queries";
import { api } from "@/lib/api";
import { ISSUE_CATEGORY_LABEL, SEVERITY_LABEL } from "@/lib/labels";
import { ISSUE_CATEGORIES, SEVERITIES, type IssueCategory, type Severity } from "@/types/domain";

const schema = z.object({
  title: z.string().trim().min(3, "หัวข้ออย่างน้อย 3 ตัวอักษร").max(200),
  description: z.string().max(4000),
  severity: z.enum(SEVERITIES),
  category: z.enum(ISSUE_CATEGORIES),
  ownerId: z.string(),
  dueDate: z.string(),
  plan: z.string().max(4000),
  approach: z.string().max(4000),
});
type FormValues = z.infer<typeof schema>;

export interface FollowUpSeed {
  title: string;
  description?: string;
  severity?: Severity;
  category?: IssueCategory;
  sourceInsightId?: string;
  metricLabel?: string;
  baselineValue?: number;
}

/** Create a Follow-up Action, optionally from an insight (keeps the baseline to compare later, MOM F2). */
export function CreateFollowUpDialog({ seed, onClose }: { seed: FollowUpSeed | null; onClose: () => void }) {
  if (!seed) return null;
  return <CreateForm seed={seed} onClose={onClose} />;
}

function CreateForm({ seed, onClose }: { seed: FollowUpSeed; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: users = [] } = useUsers();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: seed.title,
      description: seed.description ?? "",
      severity: seed.severity ?? "medium",
      category: seed.category ?? "budget",
      ownerId: "",
      dueDate: "",
      plan: "",
      approach: "",
    },
  });
  const create = useMutation({
    mutationFn: (v: FormValues) =>
      api.send("/api/issues", "POST", {
        ...v,
        sourceInsightId: seed.sourceInsightId,
        metricLabel: seed.metricLabel,
        baselineValue: seed.baselineValue,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["issues"] });
      void qc.invalidateQueries({ queryKey: ["insights"] });
      void qc.invalidateQueries({ queryKey: ["home"] });
      onClose();
    },
  });
  const { register, formState } = form;

  return (
    <Dialog open onClose={onClose} title="สร้าง Follow-up Action" className="max-w-2xl">
      <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="space-y-3">
        {seed.metricLabel && seed.baselineValue !== undefined && (
          <p className="rounded-md bg-navy-50 px-3 py-2 text-xs text-navy-800">
            ค่าตั้งต้น: <b>{seed.metricLabel}</b> = {seed.baselineValue.toFixed(1)} — ระบบจะเทียบกับค่าล่าสุดเมื่อถึงวันครบกำหนด
          </p>
        )}
        <div>
          <Label htmlFor="fu-title">หัวข้อ</Label>
          <Input id="fu-title" {...register("title")} />
          <FieldError message={formState.errors.title?.message} />
        </div>
        <div>
          <Label htmlFor="fu-desc">รายละเอียด / สิ่งที่พบ</Label>
          <Textarea id="fu-desc" rows={2} className="min-h-16" {...register("description")} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="fu-plan">แผนการแก้ไข</Label>
            <Textarea id="fu-plan" rows={3} className="min-h-20" placeholder="จะทำอะไร" {...register("plan")} />
          </div>
          <div>
            <Label htmlFor="fu-approach">แนวทาง / วิธีการ</Label>
            <Textarea id="fu-approach" rows={3} className="min-h-20" placeholder="ทำอย่างไร ใช้ทรัพยากรอะไร" {...register("approach")} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <Label htmlFor="fu-sev">ความเร่งด่วน</Label>
            <Select id="fu-sev" {...register("severity")}>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {SEVERITY_LABEL[s]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="fu-cat">หมวด</Label>
            <Select id="fu-cat" {...register("category")}>
              {ISSUE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {ISSUE_CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="fu-owner">ผู้รับผิดชอบ</Label>
            <Select id="fu-owner" {...register("ownerId")}>
              <option value="">— ยังไม่ระบุ —</option>
              {users
                .filter((u) => u.isActive)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="fu-due">วันครบกำหนด</Label>
            <Input id="fu-due" type="date" {...register("dueDate")} />
          </div>
        </div>
        {create.error && <p className="text-sm text-danger">{(create.error as Error).message}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending && <Spinner className="text-white" />} สร้าง Follow-up
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
