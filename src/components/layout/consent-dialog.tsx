"use client";

import { ArrowRight, BadgeCheck, Briefcase, Check, ImageIcon, Info, Lock, Mail, Settings2, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Avatar } from "./topbar";
import { useCurrentUser } from "./user-context";

export const CONSENT_FIELDS = [
  { key: "name", label: "ชื่อ - นามสกุล", hint: "ใช้แสดงผลในระบบและในรายการ Follow-up", icon: UserRound },
  { key: "email", label: "อีเมล", hint: "ใช้ส่งการแจ้งเตือนและติดตามงาน", icon: Mail },
  { key: "jobTitle", label: "ตำแหน่งงาน", hint: "ใช้แสดงในเมนูโปรไฟล์", icon: Briefcase },
  { key: "photo", label: "รูปโปรไฟล์", hint: "จาก Microsoft 365 (Teams / Outlook) ใช้แสดงตัวตนในระบบ", icon: ImageIcon },
] as const;
export type ConsentChoice = Record<(typeof CONSENT_FIELDS)[number]["key"], boolean>;

const ALL: ConsentChoice = { name: true, email: true, jobTitle: true, photo: true };
const NONE: ConsentChoice = { name: false, email: false, jobTitle: false, photo: false };

/**
 * Welcome + consent, shown once on first sign-in (MOM A7). Two panels: welcome
 * on the left, a preview of the Microsoft 365 data and the choices on the
 * right. Nothing is required: "skip", Esc and the close button allow nothing.
 */
export function ConsentDialog() {
  const user = useCurrentUser();
  const router = useRouter();
  const titleId = useId();
  const primaryRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(!user.consentDecided);
  const [choice, setChoice] = useState<ConsentChoice>(ALL);
  const [customize, setCustomize] = useState(false);
  const [details, setDetails] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (values: ConsentChoice) => {
      setBusy(true);
      try {
        await api.send("/api/me/consent", "POST", values);
        setOpen(false);
        router.refresh();
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  useEffect(() => {
    if (!open) return;
    primaryRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) void submit(NONE);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, submit]);

  if (!open) return null;
  const skip = () => void submit(NONE);

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-navy-950/45 p-3 backdrop-blur-sm sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative my-auto grid h-fit w-full max-w-4xl overflow-hidden rounded-3xl border border-white/70 bg-gradient-to-br from-white via-navy-50 to-navy-100 shadow-2xl md:grid-cols-[1fr_1.05fr]"
      >
        {/* ── Left: welcome ── */}
        <section className="flex flex-col p-6 sm:p-8 lg:p-10">
          <div className="flex items-center gap-3">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-white p-1 shadow-sm ring-1 ring-navy-100">
              {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
              <img src="/brand/thai-iod-logo.png" alt="Thai Institute of Directors" className="size-14" />
            </span>
            <span className="h-14 w-px bg-navy-200" aria-hidden />
            <span className="leading-none">
              <span className="block text-xl font-extrabold tracking-wide text-navy-900">FINANCE</span>
              <span className="mt-0.5 block text-xl font-extrabold tracking-wide text-accent">INTELLIGENCE</span>
              <span className="mt-1.5 block text-[10px] tracking-[0.18em] text-navy-700">INSIGHT. ACCURACY. CONFIDENCE.</span>
            </span>
          </div>

          <h2 id={titleId} className="mt-6 text-2xl leading-tight font-bold text-navy-900 sm:text-3xl">
            ยินดีต้อนรับสู่
            <span className="block">IOD Finance Intelligence</span>
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-navy-800 sm:text-base">
            เพื่อมอบประสบการณ์ที่เหมาะกับคุณ ระบบขอใช้ข้อมูลโปรไฟล์จาก Microsoft 365 เพื่อแสดงข้อมูลส่วนบุคคล
            และแจ้งเตือนงานที่เกี่ยวข้องกับคุณ เลือกได้ตามต้องการ ไม่บังคับ
          </p>
        </section>

        {/* ── Right: what will be used ── */}
        <section className="relative m-3 rounded-2xl bg-white/85 p-5 shadow-sm ring-1 ring-navy-100 backdrop-blur sm:m-4 sm:p-6">
          <button
            type="button"
            onClick={skip}
            disabled={busy}
            aria-label="ปิด (ข้ามไปก่อน)"
            className="absolute top-3 right-3 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-navy-900 cursor-pointer"
          >
            <X className="size-5" />
          </button>

          <h3 className="pr-8 text-lg font-semibold text-navy-900">ตัวอย่างข้อมูลที่จะนำมาใช้</h3>
          <p className="text-sm text-muted-foreground">ระบบจะดึงข้อมูลต่อไปนี้จากบัญชี Microsoft 365 ของคุณ</p>

          <div className="mt-3 flex items-center gap-3 rounded-xl border border-navy-100 bg-white p-3 shadow-sm">
            <Avatar name={user.name} image={user.image} size={48} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span className="truncate text-base font-semibold text-navy-900">{user.name}</span>
                <span className="rounded-full bg-navy-50 px-2.5 py-0.5 text-xs font-medium text-navy-700 ring-1 ring-navy-100">ตัวอย่างข้อมูล</span>
              </div>
              <div className="text-sm text-navy-800">{user.jobTitle ?? "ตำแหน่งงานจาก Microsoft 365"}</div>
              <div className="text-sm text-muted-foreground">Thai Institute of Directors</div>
              <div className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-navy-700">
                <Mail className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{user.email}</span>
              </div>
            </div>
          </div>

          <fieldset className="mt-3 space-y-2">
            <legend className="sr-only">ข้อมูลที่อนุญาตให้ระบบใช้</legend>
            {CONSENT_FIELDS.map((f) => {
              const on = choice[f.key];
              return (
                <label
                  key={f.key}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-navy-100 bg-white px-3.5 py-2",
                    customize ? "cursor-pointer hover:bg-navy-50/60" : "cursor-default",
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy-50 text-navy-800" aria-hidden>
                    <f.icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-navy-900">{f.label}</span>
                    <span className="block text-xs text-muted-foreground">{f.hint}</span>
                  </span>
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={on}
                    disabled={!customize}
                    onChange={(e) => setChoice({ ...choice, [f.key]: e.target.checked })}
                  />
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-navy-500 peer-focus-visible:ring-offset-2",
                      on ? "border-navy-800 bg-navy-800 text-white" : "border-navy-300 bg-white text-transparent",
                    )}
                  >
                    <Check className="size-4" />
                  </span>
                </label>
              );
            })}
          </fieldset>

          <button
            type="button"
            onClick={() => setDetails((d) => !d)}
            aria-expanded={details}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-navy-700 underline underline-offset-4 hover:text-navy-900 cursor-pointer"
          >
            <Info className="size-4" aria-hidden /> ดูรายละเอียดเพิ่มเติม
          </button>
          {details && (
            <p className="mt-2 rounded-lg bg-navy-50 p-3 text-xs leading-relaxed text-navy-800">
              ระบบอ่านข้อมูลผ่าน Microsoft Entra ID (Azure) ขององค์กรเท่านั้น ไม่ได้อ่านอีเมล ไฟล์ หรือปฏิทินของคุณ ข้อที่ไม่อนุญาตจะไม่ถูกดึงมา
              และเปลี่ยนการอนุญาตได้ทุกเมื่อที่เมนูรูปโปรไฟล์มุมขวาบน → โปรไฟล์และการตั้งค่า
            </p>
          )}

          <Button
            ref={primaryRef}
            size="lg"
            className="mt-4 h-11 w-full justify-between text-base"
            disabled={busy}
            onClick={() => void submit(customize ? choice : ALL)}
          >
            <span className="flex items-center gap-2">
              {busy ? <Spinner className="text-white" /> : <BadgeCheck className="size-5" />}
              {customize ? "อนุญาตตามที่เลือกและเริ่มใช้งาน" : "อนุญาตและเริ่มใช้งาน"}
            </span>
            <ArrowRight className="size-5" />
          </Button>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1.4fr_1fr]">
            <Button variant="outline" disabled={busy} aria-pressed={customize} onClick={() => setCustomize((c) => !c)}>
              <Settings2 /> {customize ? "กลับไปใช้ค่าแนะนำ" : "กำหนดรายละเอียดเพิ่มเติม"}
            </Button>
            <Button variant="outline" disabled={busy} onClick={skip}>
              ข้ามไปก่อน
            </Button>
          </div>
          {customize && <p className="mt-2 text-xs text-navy-700">คลิกที่แต่ละรายการเพื่อเลือกหรือยกเลิก</p>}

          <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            ข้อมูลของคุณจะถูกใช้เฉพาะภายในระบบ IOD Finance Intelligence และสามารถเปลี่ยนแปลงการอนุญาตได้ภายหลัง
          </p>
        </section>
      </div>
    </div>
  );
}

/** Edit consent later (profile page). */
export function ConsentForm({
  open,
  title,
  choice,
  onChange,
  busy,
  onSkip,
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  choice: ConsentChoice;
  onChange: (c: ConsentChoice) => void;
  busy: boolean;
  onSkip: () => void;
  onSubmit: () => void;
  onClose?: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose ?? onSkip} title={title}>
      <p className="text-sm text-muted-foreground">
        ระบบขออนุญาตดึงข้อมูลต่อไปนี้จากบัญชี Microsoft 365 ของคุณผ่าน Azure เพื่อให้ใช้งานได้สะดวกขึ้น
        เลือกได้ตามต้องการ ไม่บังคับ และเปลี่ยนภายหลังได้ที่เมนูรูปโปรไฟล์มุมขวาบน
      </p>
      <div className="mt-4 space-y-2">
        {CONSENT_FIELDS.map((f) => (
          <label key={f.key} className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-navy-50/60">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-navy-800"
              checked={choice[f.key]}
              onChange={(e) => onChange({ ...choice, [f.key]: e.target.checked })}
            />
            <span>
              <span className="block text-sm font-medium text-navy-900">{f.label}</span>
              <span className="block text-xs text-muted-foreground">{f.hint}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onSkip} disabled={busy}>
          ไม่อนุญาต / ข้ามไปก่อน
        </Button>
        <Button onClick={onSubmit} disabled={busy}>
          {busy && <Spinner className="text-white" />} อนุญาตตามที่เลือก
        </Button>
      </div>
    </Dialog>
  );
}
