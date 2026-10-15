import type { TierId } from "@/lib/access/catalog";

/**
 * Demo accounts for local development (AUTH_DEMO_LOGIN=true only — never in
 * production). Mock names and data. The login page signs in as the default
 * persona with one button; switch persona on the profile page.
 */
export interface DemoPersona {
  key: "basic" | "standard" | "advanced" | "it";
  /** Seed user id (server/repository/seed.ts). */
  userId: string;
  label: string;
  tier: TierId;
  hint: string;
}

export const DEMO_PERSONAS: DemoPersona[] = [
  { key: "basic", userId: "staff", label: "Basic", tier: "basic", hint: "ดู Dashboard / Insight · อัปโหลดไฟล์ · Follow-up" },
  { key: "standard", userId: "manager", label: "Standard", tier: "standard", hint: "Basic + เขียน Note · Export · FINLEY · สร้างกราฟ" },
  { key: "advanced", userId: "cfo", label: "Advanced", tier: "advanced", hint: "Standard + Scenario · แก้เกณฑ์แจ้งเตือน (ผู้บริหารการเงิน)" },
  { key: "it", userId: "admin", label: "IT", tier: "it", hint: "ทุกอย่าง + จัดการผู้ใช้และระดับสิทธิ์ (ทีม IT)" },
];

/** One-button login signs in as this persona (new users start as Basic, MOM A3). */
export const DEFAULT_PERSONA = DEMO_PERSONAS[0];
