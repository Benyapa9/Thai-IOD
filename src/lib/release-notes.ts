/** "What's new" entries shown at the bottom of Home (MOM H4). Newest first. */
export const RELEASE_NOTES: { date: string; title: string; items: string[] }[] = [
  {
    date: "2026-10-06",
    title: "ปรับประสบการณ์ใช้งานตามผลรีวิว",
    items: [
      "หน้า Home ใหม่: Insight of the Day และคู่มือการใช้งาน",
      "ผู้ช่วย FINLEY แบบแชตลอย ลากไปวางมุมไหนของจอก็ได้",
      "สิทธิ์ผู้ใช้แบบ Basic / Standard / Advanced และกำหนดแผนกที่ดูข้อมูลได้",
      "Dashboard: ฟิลเตอร์หลายหน่วยงาน, Export รายงาน PDF, ขยายกราฟ, ตารางเรียงลำดับได้",
      "เกณฑ์แจ้งเตือน KPI แยกตาม Dashboard",
      "Follow-up Actions ติดตามแผนและผลลัพธ์ได้, หน้าแจ้งปัญหา / ข้อเสนอแนะ, My Usage Log",
    ],
  },
  {
    date: "2026-10-01",
    title: "คำนวณตาม Business Blueprint",
    items: [
      "Dashboard Main, P&L และ Capital คำนวณตาม Blueprint ที่ลงนามแล้ว",
      "รองรับไฟล์ Actual รายเดือน ม.ค.–ส.ค. รวมเป็นค่าสะสม (YTD)",
    ],
  },
  {
    date: "2026-09-30",
    title: "อัปโหลดไฟล์ข้อมูลต้นทาง",
    items: ["อัปโหลดไฟล์ 10 ประเภท ระบบจับคู่ประเภทไฟล์จากชื่อไฟล์ให้อัตโนมัติ"],
  },
];
