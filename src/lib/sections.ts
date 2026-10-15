/** App sections, used for usage tracking (MOM F4) and the Home guide progress (MOM H1). */
export const SECTIONS = {
  home: { href: "/home", label: { th: "หน้าแรก", en: "Home" } },
  insight: { href: "/insights", label: { th: "Insight", en: "Insight" } },
  dashboard: { href: "/dashboard", label: { th: "Dashboard", en: "Dashboard" } },
  scenario: { href: "/scenario", label: { th: "Scenario Planning", en: "Scenario Planning" } },
  followUp: { href: "/follow-up", label: { th: "Follow-up Actions", en: "Follow-up Actions" } },
  upload: { href: "/upload", label: { th: "อัปโหลดข้อมูล", en: "Upload data" } },
  feedback: { href: "/feedback", label: { th: "แจ้งปัญหา / ข้อเสนอแนะ", en: "Feedback" } },
  usage: { href: "/usage", label: { th: "My Usage Log", en: "My Usage Log" } },
  profile: { href: "/profile", label: { th: "โปรไฟล์และการตั้งค่า", en: "Profile & settings" } },
  admin: { href: "/admin", label: { th: "จัดการสิทธิ์ผู้ใช้", en: "User access" } },
} as const;
export type SectionKey = keyof typeof SECTIONS;

/** The 4 menus the Home guide asks new users to explore. */
export const GUIDE_SECTIONS: SectionKey[] = ["insight", "dashboard", "scenario", "followUp"];

export function sectionOf(path: string): SectionKey | null {
  const entries = Object.entries(SECTIONS) as [SectionKey, (typeof SECTIONS)[SectionKey]][];
  const hit = entries
    .filter(([, s]) => path === s.href || path.startsWith(`${s.href}/`))
    .sort((a, b) => b[1].href.length - a[1].href.length)[0];
  return hit?.[0] ?? null;
}
