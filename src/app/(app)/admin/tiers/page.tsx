"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, ChevronDown, Grid3x3, Minus, RotateCcw, Save, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { useCurrentUser } from "@/components/layout/user-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { ErrorBlock, LoadingBlock, PageHeader, Spinner } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { type FeatureKey, FEATURE_BY_KEY, LOCKOUT_FEATURES, type TierId } from "@/lib/access/catalog";
import {
  type CellState,
  type Effect,
  type GrantChange,
  type GrantMap,
  applyChanges,
  cellState,
  clickCell,
  lockoutProblems,
  normalizeChanges,
  resolveEffectiveFeatures,
  setCell,
  tierDelta,
} from "@/lib/access/engine";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { MatrixResponse } from "@/server/access-admin";

const KEY = ["access-matrix"] as const;
const cellId = (tier: TierId, key: FeatureKey) => `${tier}:${key}`;

/** Access matrix (access-matrix phase 4, mockup docs/mockups/matrix.webp). */
export default function TiersPage() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading, error } = useQuery({ queryKey: KEY, queryFn: () => api.get<MatrixResponse>("/api/access/matrix") });
  const [pending, setPending] = useState<Record<string, Effect | null>>({});
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [confirming, setConfirming] = useState(false);

  const server: GrantMap = useMemo(() => data?.grants ?? {}, [data]);
  const changes: GrantChange[] = useMemo(
    () =>
      normalizeChanges(
        server,
        Object.entries(pending).map(([id, effect]) => {
          const [tierId, featureKey] = id.split(":") as [TierId, FeatureKey];
          return { tierId, featureKey, effect };
        }),
      ),
    [server, pending],
  );
  const working = useMemo(() => applyChanges(server, changes), [server, changes]);
  const lockout = lockoutProblems(working);

  const save = useMutation({
    mutationFn: () => api.send<MatrixResponse>("/api/access/matrix", "PUT", { version: data!.version, changes }),
    onSuccess: (next) => {
      qc.setQueryData(KEY, next);
      setPending({});
      setConfirming(false);
      toast.show({ tone: "success", text: `บันทึกระดับสิทธิ์แล้ว (${changes.length} ช่อง) ผู้ใช้จะเห็นผลภายใน 1 นาที` });
    },
    onError: (err) => {
      setConfirming(false);
      toast.show({ tone: "error", text: (err as Error).message || "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง" });
    },
  });

  if (isLoading) return <LoadingBlock />;
  if (error || !data) return <ErrorBlock error={error} />;

  const tiers = data.tiers;
  const setOne = (tier: TierId, key: FeatureKey, effect: Effect | null) =>
    setPending((p) => {
      const next = { ...p };
      if ((server[tier]?.[key] ?? null) === effect) delete next[cellId(tier, key)];
      else next[cellId(tier, key)] = effect;
      return next;
    });
  const unsaved = (tier: TierId, key: FeatureKey) => changes.some((c) => c.tierId === tier && c.featureKey === key);

  // "Before you save" summary.
  const deltas = tiers.map((t) => ({ tier: t, ...tierDelta(t.id, server, working) })).filter((d) => d.added.length || d.removed.length);
  const affectedUsers = deltas.reduce((s, d) => s + d.tier.users, 0);

  return (
    <div>
      <PageHeader
        icon={Grid3x3}
        tone="navy"
        title="กำหนดสิทธิ์การใช้งานตามระดับ"
        description="คลิกที่ช่องเพื่อเพิ่มหรือลบสิทธิ์ของแต่ละระดับ ทั้งการเข้าเมนูและการกระทำในหน้านั้น ระดับที่สูงกว่าจะได้สิทธิ์ของระดับก่อนหน้าโดยอัตโนมัติ แก้เสร็จแล้วกดบันทึกเพื่อยืนยัน"
        actions={
          <Link href="/admin/users" className="text-sm font-medium text-navy-700 hover:underline">
            ไปที่ จัดการผู้ใช้ →
          </Link>
        }
      />

      {/* Inheritance chain */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-navy-800">สืบทอดต่อกัน</span>
        {tiers.map((t, i) => (
          <Fragment key={t.id}>
            {i > 0 && <ArrowRight className="size-3.5 text-navy-400" aria-hidden />}
            <span className="rounded-full border border-navy-200 bg-white px-3 py-1">
              <b className="text-navy-900">{t.name}</b> <span className="text-muted-foreground">· {t.legacyRole} · {t.users} คน</span>
            </span>
          </Fragment>
        ))}
      </div>

      <Legend />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden">
          <div className="max-h-[75vh] overflow-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <caption className="sr-only">ตารางสิทธิ์: แถวคือฟีเจอร์ คอลัมน์คือระดับ</caption>
              <thead className="sticky top-0 z-20 bg-white">
                <tr className="border-b border-border">
                  <th scope="col" className="sticky left-0 z-10 bg-white px-4 py-3 text-left text-xs font-semibold text-navy-800">
                    เมนูและฟีเจอร์ ({data.features.length})
                  </th>
                  {tiers.map((t) => (
                    <th key={t.id} scope="col" className="w-24 px-2 py-3 text-center">
                      <div className="text-sm font-semibold text-navy-900">{t.name}</div>
                      <div className="text-[11px] font-normal text-muted-foreground">{t.legacyRole}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.groups.map((g) => {
                  const feats = data.features.filter((f) => f.groupKey === g.key) as { key: FeatureKey; name: string; pending?: boolean }[];
                  if (!feats.length) return null;
                  const isClosed = !!closed[g.key];
                  return (
                    <Fragment key={g.key}>
                      <tr className="border-b border-border bg-navy-50/70">
                        <th scope="rowgroup" className="sticky left-0 z-10 bg-navy-50 px-2 py-2 text-left">
                          <button
                            type="button"
                            onClick={() => setClosed((c) => ({ ...c, [g.key]: !isClosed }))}
                            aria-expanded={!isClosed}
                            className="flex items-center gap-2 rounded px-2 py-1 text-sm font-semibold text-navy-900 hover:bg-white cursor-pointer"
                          >
                            <ChevronDown className={cn("size-4 transition-transform", isClosed && "-rotate-90")} aria-hidden />
                            {g.name}
                            <span className="text-xs font-normal text-muted-foreground">
                              {g.route} · {feats.length} ฟีเจอร์
                            </span>
                          </button>
                        </th>
                        {tiers.map((t) => {
                          const states = feats.map((f) => cellState(t.id, f.key, working));
                          const on = states.filter((s) => s.effective).length;
                          const all = on === feats.length;
                          const some = on > 0 && !all;
                          const dirty = feats.some((f) => unsaved(t.id, f.key));
                          return (
                            <td key={t.id} className="px-2 py-2 text-center">
                              <MatrixBox
                                kind={all ? "on" : some ? "mixed" : "off"}
                                dirty={dirty}
                                label={`${t.name}: ทั้งหมวด ${g.name} — ${all ? "มีสิทธิ์ครบ กดเพื่อนำออกทั้งหมด" : some ? `มี ${on} จาก ${feats.length} ฟีเจอร์ กดเพื่อให้ครบ` : "ยังไม่มีสิทธิ์ กดเพื่อให้ทั้งหมวด"}`}
                                onClick={() => feats.forEach((f, i) => setOne(t.id, f.key, setCell(states[i], !all)))}
                              />
                            </td>
                          );
                        })}
                      </tr>
                      {!isClosed &&
                        feats.map((f) => (
                          <tr key={f.key} className="border-b border-border/70 hover:bg-navy-50/40">
                            <th scope="row" className="sticky left-0 z-10 bg-white px-4 py-2.5 text-left font-normal">
                              <span className="pl-6 text-sm text-navy-900">{f.name}</span>{" "}
                              <code className="text-[11px] text-muted-foreground">{f.key}</code>
                              {f.pending && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">รอยืนยัน</span>}
                            </th>
                            {tiers.map((t) => {
                              const s = cellState(t.id, f.key, working);
                              return (
                                <td key={t.id} className="px-2 py-2 text-center">
                                  <MatrixBox
                                    kind={cellKind(s)}
                                    dirty={unsaved(t.id, f.key)}
                                    label={`${t.name}: ${f.name} — ${cellDescription(s)}`}
                                    onClick={() => setOne(t.id, f.key, clickCell(s))}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-4 xl:sticky xl:top-20">
          <Card className="p-5">
            <h2 className="text-base font-semibold text-navy-900">สรุปก่อนบันทึก</h2>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-bold tabular-nums text-navy-900">{changes.length ? affectedUsers : 0}</span>
              <span className="text-sm text-muted-foreground">คนที่จะได้รับผลจากการแก้ไขนี้</span>
            </p>
            {!changes.length && <p className="mt-2 text-sm text-muted-foreground">ยังไม่มีการเปลี่ยนแปลง คลิกช่องในตารางเพื่อเริ่มแก้ไข</p>}
            <ul className="mt-3 space-y-2">
              {deltas.map((d) => (
                <li key={d.tier.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
                  <div className="flex justify-between font-semibold text-navy-900">
                    <span>
                      {d.tier.name} ({d.tier.legacyRole})
                    </span>
                    <span className="font-normal text-muted-foreground">{d.tier.users} คน</span>
                  </div>
                  {d.added.map((k) => (
                    <div key={k} className="text-success">+ {FEATURE_BY_KEY[k].name}</div>
                  ))}
                  {d.removed.map((k) => (
                    <div key={k} className="text-danger">− {FEATURE_BY_KEY[k].name}</div>
                  ))}
                </li>
              ))}
            </ul>
            {lockout.length > 0 && (
              <p role="alert" className="mt-3 flex gap-2 rounded-lg bg-danger-soft p-3 text-sm text-danger">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                ระดับ IT ต้องมีสิทธิ์ “{lockout.map((k) => FEATURE_BY_KEY[k].name).join("” และ “")}” เสมอ ไม่เช่นนั้นจะไม่มีใครแก้สิทธิ์ได้อีก
                กรุณาคืนสิทธิ์นี้ก่อนบันทึก
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <Button className="flex-1" disabled={!changes.length || lockout.length > 0 || save.isPending} onClick={() => setConfirming(true)}>
                {save.isPending ? <Spinner className="text-white" /> : <Save />} บันทึกการเปลี่ยนแปลง
              </Button>
              <Button variant="outline" disabled={!changes.length || save.isPending} onClick={() => setPending({})}>
                <RotateCcw /> ล้างที่แก้
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold text-navy-900">ฟีเจอร์ที่แต่ละระดับใช้ได้</h2>
            <ul className="mt-3 space-y-3">
              {tiers.map((t) => {
                const n = resolveEffectiveFeatures(t.id, working).size;
                return (
                  <li key={t.id}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-navy-900">
                        {t.name} ({t.legacyRole})
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {n} / {data.features.length} ฟีเจอร์
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-navy-100" aria-hidden>
                      <div className="h-2 rounded-full bg-navy-700" style={{ width: `${(n / data.features.length) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              ระดับ IT ต้องมี {LOCKOUT_FEATURES.map((k) => FEATURE_BY_KEY[k].name).join(" และ ")} เสมอ · คุณคือ {me.name}
            </p>
          </Card>
        </div>
      </div>

      {confirming && (
        <Dialog open onClose={() => setConfirming(false)} title="ยืนยันการบันทึกระดับสิทธิ์">
          <p className="text-sm text-navy-800">
            การเปลี่ยนแปลง {changes.length} ช่องจะมีผลกับผู้ใช้ {affectedUsers} คน ภายใน 1 นาทีหลังบันทึก ระบบจะเก็บประวัติการแก้ไขไว้
          </p>
          <ul className="mt-3 max-h-60 space-y-1 overflow-y-auto text-sm">
            {deltas.map((d) => (
              <li key={d.tier.id}>
                <b>{d.tier.name}</b>: {d.added.length ? `+${d.added.length}` : ""} {d.removed.length ? `−${d.removed.length}` : ""} ฟีเจอร์
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              กลับไปแก้ไข
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Spinner className="text-white" /> : <Check />} ยืนยันบันทึก
            </Button>
          </div>
        </Dialog>
      )}
      {toast.node}
    </div>
  );
}

type BoxKind = "on" | "inherited" | "denied" | "off" | "mixed";

function cellKind(s: CellState): BoxKind {
  if (s.explicit === "allow") return "on";
  if (s.explicit === "deny") return "denied";
  return s.inherited ? "inherited" : "off";
}

function cellDescription(s: CellState) {
  if (s.explicit === "allow") return s.inherited ? "กำหนดที่ระดับนี้ (และสืบทอดมาด้วย) กดเพื่อนำออก" : "กำหนดที่ระดับนี้ กดเพื่อนำออก";
  if (s.explicit === "deny") return "ยกเว้นไว้ ไม่มีสิทธิ์ กดเพื่อกลับไปสืบทอด";
  return s.inherited ? "สืบทอดมาจากระดับก่อนหน้า กดเพื่อยกเว้น" : "ไม่มีสิทธิ์ กดเพื่อให้สิทธิ์";
}

const boxClass = (kind: BoxKind, dirty: boolean) =>
  cn(
    "inline-flex size-7 items-center justify-center rounded-md border-2 transition-colors",
    kind === "on" && "border-navy-800 bg-navy-800 text-white",
    kind === "inherited" && "border-navy-200 bg-navy-50 text-navy-400",
    kind === "denied" && "border-danger bg-white text-danger",
    kind === "mixed" && "border-navy-600 bg-white text-navy-700",
    kind === "off" && "border-navy-200 bg-white",
    dirty && "ring-[3px] ring-amber-400 ring-offset-1",
  );

function BoxIcon({ kind }: { kind: BoxKind }) {
  if (kind === "on" || kind === "inherited") return <Check className="size-4" strokeWidth={3} aria-hidden />;
  if (kind === "denied" || kind === "mixed") return <Minus className="size-4" strokeWidth={3} aria-hidden />;
  return null;
}

/** One matrix cell — a real button with a full description (colour is never the only cue). */
function MatrixBox({ kind, dirty, label, onClick }: { kind: BoxKind; dirty: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}${dirty ? " (ยังไม่บันทึก)" : ""}`}
      title={label}
      className={cn(boxClass(kind, dirty), "cursor-pointer hover:border-navy-500 focus-visible:outline-2 focus-visible:outline-offset-2")}
    >
      <BoxIcon kind={kind} />
    </button>
  );
}

function Legend() {
  const items: { kind: BoxKind; text: string; dirty?: boolean }[] = [
    { kind: "on", text: "กำหนดที่ระดับนี้" },
    { kind: "inherited", text: "สืบทอดมา (คลิกเพื่อยกเว้น)" },
    { kind: "denied", text: "ยกเว้น" },
    { kind: "off", text: "ไม่มีสิทธิ์" },
    { kind: "off", text: "ยังไม่บันทึก", dirty: true },
  ];
  return (
    <ul className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-navy-800" aria-label="คำอธิบายสัญลักษณ์">
      {items.map((i) => (
        <li key={i.text} className="flex items-center gap-1.5">
          <span aria-hidden className={cn(boxClass(i.kind, !!i.dirty), "size-5 [&_svg]:size-3")}>
            <BoxIcon kind={i.kind} />
          </span>
          {i.text}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">รอยืนยัน</span>
        สเปกยังไม่ระบุสิทธิ์ของฟีเจอร์นี้
      </li>
    </ul>
  );
}
