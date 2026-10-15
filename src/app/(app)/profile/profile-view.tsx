"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Building2, Check, Compass, Globe, Moon, Palette, Plus, ShieldCheck, Sun, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CONSENT_FIELDS, type ConsentChoice, ConsentForm } from "@/components/layout/consent-dialog";
import { Avatar } from "@/components/layout/topbar";
import { startTour } from "@/components/tour/tour-player";
import { useCan, useCurrentUser, usePrefs, useT } from "@/components/layout/user-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconBadge, PageHeader } from "@/components/ui/misc";
import { keys, useMe } from "@/hooks/queries";
import { api } from "@/lib/api";
import { DEMO_PERSONAS } from "@/lib/demo-personas";
import { TIERS } from "@/lib/access/catalog";
import { tierLabel } from "@/lib/rbac";
import { cn, formatDate } from "@/lib/utils";
import { THEMES, type Theme } from "@/types/domain";
import { switchPersona } from "./actions";

const THEME_INFO: Record<Theme, { label: string; colors: string[] }> = {
  navy: { label: "Navy (ค่าเริ่มต้น)", colors: ["#132642", "#4f71a1", "#e6edf6"] },
  teal: { label: "Teal", colors: ["#143a3b", "#2a8c8a", "#d7f0ef"] },
  burgundy: { label: "Burgundy", colors: ["#4f1e27", "#a8434f", "#f5e2e4"] },
  forest: { label: "Forest", colors: ["#1c392b", "#3d8a5f", "#ddeee3"] },
  graphite: { label: "Graphite", colors: ["#2b2f36", "#5f6b7a", "#e8eaee"] },
  custom: { label: "สีที่เลือกเอง", colors: ["var(--color-navy-900)", "var(--color-navy-500)", "var(--color-navy-100)"] },
};

export function ProfileView({ demoEnabled }: { demoEnabled: boolean }) {
  const user = useCurrentUser();
  const t = useT();
  const { theme, setTheme, locale, setLocale, mode, setMode, customColor, setCustomColor } = usePrefs();
  const isAdmin = useCan("users.manage");
  const { data: me } = useMe();
  const router = useRouter();
  const qc = useQueryClient();
  const [editConsent, setEditConsent] = useState(false);
  const [choice, setChoice] = useState<ConsentChoice | null>(null);
  const [busy, setBusy] = useState(false);

  const consent = me?.consent ?? null;
  const current: ConsentChoice = choice ?? {
    name: consent?.name ?? false,
    email: consent?.email ?? false,
    jobTitle: consent?.jobTitle ?? false,
    photo: consent?.photo ?? false,
  };

  async function saveConsent(values: ConsentChoice) {
    setBusy(true);
    try {
      await api.send("/api/me/consent", "POST", values);
      setEditConsent(false);
      setChoice(null);
      void qc.invalidateQueries({ queryKey: keys.me });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader icon={UserRound} tone="navy" title={t("profile.title")} description="ข้อมูลส่วนตัว ระดับสิทธิ์ ธีมสี ภาษา และการอนุญาตข้อมูลจาก Microsoft" />

      <Card className="flex flex-wrap items-center gap-4 p-5">
        <Avatar name={user.name} image={user.image} size={64} />
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold text-navy-900">{user.name}</div>
          <div className="text-sm text-muted-foreground">{user.jobTitle ?? "—"}</div>
          <div className="text-sm text-muted-foreground">{user.email}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="solid" className="px-3 py-1 text-sm">
            {tierLabel(user.tier)} User
          </Badge>
          <Button variant="outline" size="sm" onClick={() => startTour()}>
            <Compass /> {t("tour.replay")}
          </Button>
        </div>
      </Card>

      {demoEnabled && (
        <Card className="p-5">
          <div className="mb-1 flex items-center gap-2.5">
            <IconBadge icon={Users} tone="navy" size="sm" />
            <h2 className="text-[15px] font-semibold text-navy-900">{t("persona.title")}</h2>
            <Badge variant="warning">Local Dev</Badge>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            สำหรับทดลองระบบเท่านั้น (ไม่มีบน Production) — ชื่อและข้อมูลเป็นข้อมูลสมมติ เลือกแล้วระบบจะเข้าสู่ระบบใหม่ด้วยบัญชีนั้น
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {DEMO_PERSONAS.map((p) => {
              const current = p.userId === user.id;
              return (
                <form key={p.key} action={switchPersona}>
                  <input type="hidden" name="persona" value={p.key} />
                  <button
                    type="submit"
                    disabled={current}
                    aria-current={current ? "true" : undefined}
                    className={cn(
                      "flex h-full min-h-11 w-full flex-col items-start rounded-xl border p-3 text-left transition-colors cursor-pointer disabled:cursor-default",
                      current ? "border-navy-700 bg-navy-900 text-white" : "border-border bg-white hover:border-navy-300 hover:bg-navy-50",
                    )}
                  >
                    <span className="flex w-full items-center justify-between text-sm font-semibold">
                      {p.label}
                      {current && <Check className="size-4" />}
                    </span>
                    <span className={cn("mt-0.5 text-xs", current ? "text-navy-100" : "text-muted-foreground")}>{p.hint}</span>
                  </button>
                </form>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconBadge icon={ShieldCheck} tone="violet" size="sm" /> ระดับสิทธิ์การใช้งาน
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {TIERS.map((tier) => (
              <div key={tier.id} className={cn("rounded-lg border p-3", tier.id === user.tier ? "border-navy-700 bg-navy-50" : "border-border opacity-70")}>
                <div className="flex items-center gap-2 text-sm font-semibold text-navy-900">
                  {tier.id === user.tier && <Check className="size-4 text-success" />} {tier.name}
                  {tier.id === user.tier && <span className="text-xs font-normal text-muted-foreground">(ระดับของคุณ · ใช้ได้ {user.features.length} ฟีเจอร์)</span>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{tier.summary}</p>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">ต้องการสิทธิ์เพิ่ม? ติดต่อผู้ดูแลระบบ (ทีม IT){isAdmin && " — หรือจัดการได้ที่ "}
              {isAdmin && (
                <Link href="/admin/users" className="font-medium text-navy-700 hover:underline">
                  {t("nav.admin")}
                </Link>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconBadge icon={Building2} tone="teal" size="sm" /> หน่วยงานที่ดูข้อมูลได้
            </CardTitle>
          </CardHeader>
          <CardContent>
            {user.departments ? (
              <div className="flex flex-wrap gap-1.5">
                {user.departments.map((d) => (
                  <Badge key={d}>{d}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-navy-900">ทุกหน่วยงาน</p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">กำหนดโดยผู้ดูแลระบบ Dashboard, Insight และ FINLEY จะแสดงเฉพาะข้อมูลของหน่วยงานเหล่านี้</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconBadge icon={Palette} tone="pink" size="sm" /> {t("nav.theme")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {THEMES.filter((th) => th !== "custom" || theme === "custom").map((th) => (
              <button
                key={th}
                type="button"
                onClick={() => setTheme(th)}
                className={cn("flex items-center gap-3 rounded-lg border p-3 text-left cursor-pointer", theme === th ? "border-navy-700 ring-2 ring-navy-200" : "border-border hover:bg-navy-50")}
              >
                <span className="flex overflow-hidden rounded-md">
                  {THEME_INFO[th].colors.map((c) => (
                    <span key={c} className="h-8 w-5" style={{ background: c }} />
                  ))}
                </span>
                <span className="text-sm text-navy-900">{THEME_INFO[th].label}</span>
                {theme === th && <Check className="ml-auto size-4 text-success" />}
              </button>
            ))}
            <label className="relative flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-navy-300 p-3 text-sm text-navy-900 hover:bg-navy-50 focus-within:ring-2 focus-within:ring-navy-500">
              <span className="flex size-8 items-center justify-center rounded-md border border-navy-200" style={{ background: customColor }}>
                <Plus className="size-4 text-white drop-shadow" aria-hidden />
              </span>
              เพิ่มสีเอง (เลือกจากจานสี)
              <input type="color" value={customColor} onChange={(e) => setCustomColor(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" />
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-border p-3 sm:col-span-2" role="group" aria-label="โหมดการแสดงผล">
              <span className="mr-auto text-sm text-navy-900">โหมดการแสดงผล</span>
              {([
                ["light", "กลางวัน", Sun],
                ["dark", "กลางคืน", Moon],
              ] as const).map(([m, label, Icon]) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm cursor-pointer", mode === m ? "bg-navy-900 text-white" : "text-navy-800 hover:bg-navy-50")}
                >
                  <Icon className="size-4" aria-hidden /> {label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconBadge icon={Globe} tone="blue" size="sm" /> {t("nav.language")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2">
              {(["th", "en"] as const).map((l) => (
                <Button key={l} variant={locale === l ? "default" : "outline"} onClick={() => setLocale(l)}>
                  {l === "th" ? "ภาษาไทย" : "English"}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconBadge icon={UserRound} tone="navy" size="sm" /> ข้อมูลจาก Microsoft 365
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setEditConsent(true)}>
                เปลี่ยนการอนุญาต
              </Button>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {CONSENT_FIELDS.map((f) => (
                  <li key={f.key} className="flex items-center justify-between">
                    <span className="text-navy-900">{f.label}</span>
                    {consent?.[f.key] ? <Badge variant="success">อนุญาต</Badge> : <Badge variant="muted">ไม่อนุญาต</Badge>}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                {consent ? `ตัดสินใจเมื่อ ${formatDate(consent.decidedAt)} · ` : ""}
                ระบบดึงข้อมูลผ่าน Microsoft Graph เมื่อเข้าสู่ระบบด้วย Microsoft
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConsentForm
        open={editConsent}
        title={t("consent.title")}
        choice={current}
        onChange={setChoice}
        busy={busy}
        onClose={() => {
          setEditConsent(false);
          setChoice(null);
        }}
        onSkip={() => saveConsent({ name: false, email: false, jobTitle: false, photo: false })}
        onSubmit={() => saveConsent(current)}
      />
    </div>
  );
}
