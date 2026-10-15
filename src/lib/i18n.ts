import type { Locale } from "@/types/domain";

/**
 * UI strings in Thai and English (MOM G3). Navigation, headers, buttons and
 * the guide texts are translated; data labels from source files stay as-is.
 */
const dict = {
  "app.name": { th: "IOD Finance Intelligence", en: "IOD Finance Intelligence" },
  "app.tagline": { th: "Insight. Accuracy. Confidence.", en: "Insight. Accuracy. Confidence." },

  "nav.home": { th: "หน้าแรก", en: "Home" },
  "nav.insight": { th: "Insight", en: "Insight" },
  "nav.insightOverview": { th: "ภาพรวม Insight", en: "Insight overview" },
  "nav.dashboard": { th: "Dashboard", en: "Dashboard" },
  "nav.scenario": { th: "Scenario Planning", en: "Scenario Planning" },
  "nav.followUp": { th: "Follow-up Actions", en: "Follow-up Actions" },
  "nav.feedback": { th: "แจ้งปัญหา / ข้อเสนอแนะ", en: "Report issue / Feedback" },
  "nav.usage": { th: "My Usage Log", en: "My Usage Log" },
  "nav.upload": { th: "อัปโหลดข้อมูล", en: "Upload data" },
  "nav.profile": { th: "โปรไฟล์และการตั้งค่า", en: "Profile & settings" },
  "nav.admin": { th: "จัดการสิทธิ์ผู้ใช้", en: "User access" },
  "nav.adminGroup": { th: "ผู้ดูแลระบบ", en: "Administration" },
  "nav.adminLevels": { th: "จัดการผู้ใช้", en: "Users" },
  "nav.adminTiers": { th: "ระดับสิทธิ์", en: "Access tiers" },
  "nav.adminAccess": { th: "ตั้งค่าสิทธิ์ดูข้อมูลแผนก", en: "Department data access" },
  "nav.signOut": { th: "ออกจากระบบ", en: "Sign out" },
  "nav.reportBug": { th: "รายงาน Bug/Error", en: "Report a bug / error" },
  "nav.requestFeature": { th: "เสนอ Feature / ขอความช่วยเหลือ", en: "Suggest a feature / Get help" },
  "nav.whatsNew": { th: "What's new", en: "What's new" },
  "nav.update": { th: "Update", en: "Update" },
  "nav.collapse": { th: "ย่อ/ขยายเมนู", en: "Collapse / expand menu" },
  "nav.language": { th: "ภาษา", en: "Language" },
  "nav.theme": { th: "ธีมสี", en: "Colour theme" },
  "nav.demoBanner": {
    th: "โหมดสาธิต — ใช้ข้อมูลในหน่วยความจำ (ยังไม่ได้เชื่อมต่อ Azure SQL) ข้อมูลที่บันทึกจะหายเมื่อรีสตาร์ทเซิร์ฟเวอร์",
    en: "Demo mode — data is kept in memory (Azure SQL not connected) and resets when the server restarts",
  },
  "nav.denied": { th: "คุณไม่มีสิทธิ์เข้าถึงหน้าที่ร้องขอ", en: "You don't have access to that page" },

  "common.save": { th: "บันทึก", en: "Save" },
  "common.cancel": { th: "ยกเลิก", en: "Cancel" },
  "common.close": { th: "ปิด", en: "Close" },
  "common.submit": { th: "ส่ง", en: "Submit" },
  "common.edit": { th: "แก้ไข", en: "Edit" },
  "common.delete": { th: "ลบ", en: "Delete" },
  "common.loading": { th: "กำลังโหลดข้อมูล…", en: "Loading…" },
  "common.all": { th: "ทั้งหมด", en: "All" },
  "common.back": { th: "ย้อนกลับ", en: "Back" },
  "common.search": { th: "ค้นหา…", en: "Search…" },
  "common.guide": { th: "คำแนะนำการใช้งาน", en: "How to use this page" },
  "common.hideGuide": { th: "ซ่อนคำแนะนำ", en: "Hide guide" },

  "home.greeting": { th: "สวัสดี", en: "Hello" },
  "home.progress": { th: "คุณเข้าชมแล้ว {n} จาก {total} เมนู", en: "You have explored {n} of {total} menus" },
  "home.progressDone": { th: "คุณสำรวจครบทุกเมนูแล้ว", en: "You have explored every menu" },
  "home.explore": { th: "ลองสำรวจเพิ่มดูไหม", en: "Try exploring more" },
  "home.insightOfDay": { th: "Insight of the Day", en: "Insight of the Day" },
  "home.moreInsight": { th: "ดู Insight เพิ่มเติม", en: "More Insight" },
  "home.rateQuestion": { th: "Insight นี้ตอบโจทย์หรือไม่", en: "Did this insight help?" },
  "home.updates": { th: "อัปเดตระบบล่าสุด", en: "What's new" },
  "home.dataAsOf": { th: "ข้อมูล", en: "Data" },

  "insight.title": { th: "Insight", en: "Insight" },
  "insight.subtitle": { th: "สัญญาณอัตโนมัติจากข้อมูล เรียงตามความเร่งด่วน", en: "Automatic signals from your data, most urgent first" },
  "insight.scope": { th: "ช่วงข้อมูล", en: "Data range" },
  "insight.critical": { th: "ต้องเร่งแก้ไข", en: "Needs urgent action" },
  "insight.warning": { th: "ต้องเฝ้าระวัง", en: "Watch closely" },
  "insight.warningSection": { th: "ควรเฝ้าระวัง", en: "Should be watched" },
  "insight.positive": { th: "เป็นไปตามแผน", en: "On plan" },
  "insight.info": { th: "ข้อมูลประกอบการตัดสินใจ", en: "Decision context" },
  "insight.feedbackQuestion": { th: "หน้านี้ตอบโจทย์การทำงานของคุณไหม?", en: "Does this page help your work?" },
  "insight.helpful": { th: "ตอบโจทย์", en: "Helpful" },
  "insight.notHelpful": { th: "ไม่ตอบโจทย์", en: "Not helpful" },
  "insight.requestTitle": { th: "อยากทราบ Insight อะไรเพิ่ม?", en: "What other insight would you like?" },

  "dashboard.upload": { th: "อัปโหลดข้อมูล", en: "Upload data" },
  "dashboard.export": { th: "Export รายงาน", en: "Export report" },
  "dashboard.alerts": { th: "เกณฑ์แจ้งเตือน", en: "Alert thresholds" },
  "dashboard.request": { th: "ขอ Dashboard ใหม่", en: "Request a dashboard" },
  "dashboard.asOf": { th: "ข้อมูลถึงเดือน", en: "Data up to" },
  "dashboard.departments": { th: "หน่วยงาน", en: "Departments" },
  "dashboard.allDepartments": { th: "ทุกหน่วยงาน", en: "All departments" },

  "profile.title": { th: "โปรไฟล์และการตั้งค่า", en: "Profile & settings" },
  "consent.title": { th: "ขออนุญาตใช้ข้อมูลโปรไฟล์จาก Microsoft", en: "Allow profile data from Microsoft" },

  // ── Product tour (lib/tour/tours.ts) ──
  "tour.label": { th: "ทัวร์แนะนำการใช้งาน", en: "Product tour" },
  "tour.step": { th: "ขั้น {n} จาก {total}", en: "Step {n} of {total}" },
  "tour.back": { th: "ย้อนกลับ", en: "Back" },
  "tour.next": { th: "ถัดไป", en: "Next" },
  "tour.skip": { th: "ข้ามทัวร์", en: "Skip tour" },
  "tour.done": { th: "เสร็จสิ้น", en: "Done" },
  "tour.start": { th: "เริ่มทัวร์", en: "Start tour" },
  "tour.replay": { th: "ดูทัวร์อีกครั้ง", en: "Replay tour" },
  "tour.keys": { th: "ใช้ปุ่มลูกศร ← → เพื่อเปลี่ยนขั้น · Esc เพื่อปิด", en: "Use ← → to move · Esc to close" },
  "tour.main.welcome.title": { th: "ยินดีต้อนรับสู่ IOD Finance Intelligence", en: "Welcome to IOD Finance Intelligence" },
  "tour.main.welcome.body": {
    th: "ทัวร์นี้ใช้ไม่ถึง 3 นาที จะพาไปดูว่าตัวเลขสำคัญอยู่ตรงไหน และเจอปัญหาแล้วควรทำอะไรต่อ",
    en: "This takes under 3 minutes: where the key numbers are, and what to do when something is off.",
  },
  "tour.main.insightOfDay.title": { th: "เรื่องที่ควรรู้วันนี้", en: "What to know today" },
  "tour.main.insightOfDay.body": {
    th: "ระบบเลือกประเด็นการเงินที่สำคัญที่สุดมาให้ทุกวัน กดชอบหรือไม่ชอบเพื่อให้วันถัดไปตรงใจขึ้น",
    en: "The most important financial signal, picked for you daily. Like or dislike it to tune tomorrow's pick.",
  },
  "tour.main.insightGroups.title": { th: "รู้ทันทีว่าอะไรผิดแผน", en: "See what's off plan at a glance" },
  "tour.main.insightGroups.body": {
    th: "ประเด็นถูกจัดกลุ่มตามความเร่งด่วนพร้อมมูลค่าเงิน คลิกตัวเลขเพื่อเปิด Dashboard ที่กรองไว้ให้แล้ว",
    en: "Signals are grouped by urgency with their money impact. Click a number to open the filtered dashboard.",
  },
  "tour.main.followUp.title": { th: "มอบหมายคนแก้ไขได้ทันที", en: "Assign a fix right away" },
  "tour.main.followUp.body": {
    th: "สร้าง Follow-up จากประเด็นที่พบ เมื่อถึงกำหนดระบบจะเทียบตัวเลขก่อนและหลังให้",
    en: "Turn a signal into a Follow-up. At the due date you'll see the before-and-after numbers.",
  },
  "tour.main.filters.title": { th: "ดูเฉพาะเดือนและแผนกที่สนใจ", en: "Focus on a month and department" },
  "tour.main.filters.body": {
    th: "ทุกตัวเลขเป็นยอดสะสมถึงเดือนที่เลือก และเลือกได้หลายหน่วยงานพร้อมกัน",
    en: "Every figure is year-to-date up to the chosen month, and you can pick several departments.",
  },
  "tour.main.actions.title": { th: "ส่งรายงานให้ผู้บริหาร", en: "Share a report with management" },
  "tour.main.actions.body": {
    th: "Export เป็น PDF พร้อมตัวกรองและวันที่ข้อมูล หรือดูเกณฑ์แจ้งเตือนของ Dashboard นี้",
    en: "Export a PDF with filters and data date, or check this dashboard's alert thresholds.",
  },
  "tour.main.zyinsight.title": { th: "ถาม FINLEY ได้ทุกเรื่อง", en: "Ask FINLEY anything" },
  "tour.main.zyinsight.body": {
    th: "พิมพ์ถามได้เลย เช่น “หน่วยงานไหนใช้งบเกินแผน” และลากปุ่มไปวางมุมไหนของจอก็ได้",
    en: "Just ask, e.g. “Which department is over budget?” Drag the button to any corner.",
  },
  "tour.main.admin.title": { th: "กำหนดว่าใครเห็นอะไร", en: "Decide who sees what" },
  "tour.main.admin.body": {
    th: "ตั้งระดับสิทธิ์และแผนกที่แต่ละคนดูข้อมูลได้ ในหน้าเดียว",
    en: "Set each person's access level and which departments they can see, in one place.",
  },
  "tour.main.done.title": { th: "พร้อมเริ่มใช้งานแล้ว", en: "You're ready" },
  "tour.main.done.body": {
    th: "เริ่มวันใหม่จาก Insight of the Day ได้ทุกเช้า และเปิดทัวร์นี้อีกครั้งได้จากเมนูรูปโปรไฟล์",
    en: "Start each morning with the Insight of the Day. Replay this tour any time from the profile menu.",
  },

  // ── Demo personas (profile page, local dev only) ──
  "persona.title": { th: "สลับบัญชีทดลอง (Demo)", en: "Switch demo account" },
} as const;

export type MessageKey = keyof typeof dict;

export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>) {
  let s: string = dict[key]?.[locale] ?? dict[key]?.th ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}
