import * as XLSX from "xlsx";
import Papa from "papaparse";
import { SLOT_BY_KEY } from "@/lib/upload-slots";
import { HttpError, route, requireFeature } from "@/server/http";

/**
 * Example files for each source type (MOM U7) — the right columns with a few
 * made-up rows, so new staff know what the file looks like. Not real data.
 */
const MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May.", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];

function sample(slot: string): { rows: Record<string, unknown>[] | unknown[][]; sheet: string; csv?: boolean } {
  switch (slot) {
    case "bg_year":
      return {
        sheet: "งบประมาณ",
        rows: [1, 2].map((i) => ({
          รหัสงบประมาณ: `BG2026900${i}`,
          ชื่อโครงการหรือชื่องบประมาณ: i === 1 ? "ตัวอย่าง: Director Certification Program" : "ตัวอย่าง: ค่าใช้จ่ายสำนักงาน",
          หน่วยงาน: i === 1 ? "Training & Member Engagement" : "General Affairs",
          วันที่เริ่มต้นโครงการ: "01/01/2026",
          วันที่สิ้นสุดโครงการ: "31/12/2026",
          กลุ่มงบประมาณ: "งบประมาณประจำปี",
          ประเภทงบประมาณ: "งบดำเนินงาน",
          "Profit Center": i === 1 ? "Training(Public)" : "Other",
          ประเภทรายได้ทางบัญชี: i === 1 ? "Public Trainning" : "",
          ประเภทค่าใช้จ่ายทางบัญชี: i === 1 ? "Direct expenses" : "Administrative Expenses",
          "กิจกรรม/ประเภทโครงการ": i === 1 ? "Training(Public)" : "None",
          "Course (Code)ชื่อย่อ": i === 1 ? "DCP" : "None",
          Class: i === 1 ? "401/2026" : "None",
          Year: 2026,
          Seat: i === 1 ? 60 : 0,
          "Revenue (Plan)": i === 1 ? 1200000 : 0,
          รายการ: i === 1 ? "Revenue" : "",
          ...Object.fromEntries(MONTHS.map((m, k) => [m, i === 1 && k === 2 ? 1200000 : 0])),
          "Budget Cost": i === 1 ? 480000 : 120000,
          รายการ_1: "Expense",
          ...Object.fromEntries(MONTHS.map((m, k) => [`${m}_1`, i === 1 ? (k === 2 ? 480000 : 0) : 10000])),
          สถานะโครงการ: "อนุมัติแล้ว",
        })),
      };
    case "actual":
      return {
        sheet: "gltdopt",
        rows: [
          ["Account No.", "Account Name", "", "", "", "", "Posting Seq.", "Batch-Entry", "Date", "Prd.", "Optional Field", "Value", "Description", "Reference", "Debits", "Credits"],
          ["41101-11", "DCP - Director Certification Program", "", "", "", "", 1, "1-1", "15/03/2026", 3, "BUDGET", "BG20269001", "ตัวอย่างรายได้", "JV-EXAMPLE", 0, 1200000],
          ["53005-11", "Food & Meals - Training", "", "", "", "", 2, "1-2", "15/03/2026", 3, "BUDGET", "BG20269001", "ตัวอย่างค่าใช้จ่าย", "PO-EXAMPLE", 85000, 0],
        ],
      };
    case "bg_capital":
      return {
        sheet: "Sheet1",
        rows: [
          {
            ลำดับ: 1,
            รหัสงบประมาณ: "BG20269010",
            ชื่อโครงการ: "ตัวอย่าง: เครื่องคอมพิวเตอร์",
            วันที่เริ่มต้นโครงการ: "01/02/2026",
            วันที่สิ้นสุดโครงการ: "30/06/2026",
            หน่วยงาน: "Information Technology",
            Course: "",
            "Course Name": "",
            Class: "",
            Year: 2026,
            Seat: "",
            "Profit Center": "Other",
            "รายได้ตามงบประมาณ(Revenue Plan)": 0,
            "ค่าใช้จ่ายตามงบประมาณ(Budget Cost)": 300000,
            "ค่าใช้จ่ายตามงบประมาณใช้ไป(Expense Cost)": 120000,
            "ค่าใช้จ่ายตามงบประมาณคงเหลือ(Balance Cost)": 180000,
            "ค่าใช้จ่ายที่เกิดขึ้นจริง(Expense Actual)": 120000,
          },
        ],
      };
    case "master":
      return {
        sheet: "Sheet1",
        rows: [
          { "Account Code": "41101-11", Grouping: "Foundation", "Course (Code)ชื่อย่อ": "DCP", "Training Name": "DCP-Director Certification Program" },
          { "Account Code": "41301-11", Grouping: "Skill", "Course (Code)ชื่อย่อ": "FSD", "Training Name": "FSD-Financial Statements for Directors" },
        ],
      };
    case "master_revenue":
      return {
        sheet: "master_rev_exp",
        rows: [
          { level1: "Net Operating Income", level2: "Revenue from training and seminar", level3: "Public Trainning", desc: "Public Trainning", sort_level1: 2, sort_level2: 1, sort_level3: 1 },
          { level1: "Total Direct Expense", level2: "Direct expenses", level3: "", desc: "Direct expenses", sort_level1: 7, sort_level2: 1, sort_level3: "" },
        ],
      };
    case "dept_master":
      return {
        sheet: "Dept_Master",
        rows: [
          { sort: 1, dept_code: "DEP001", department_name: "Training Services", merged_into_code: "" },
          { sort: 2, dept_code: "DEP002", department_name: "Information Technology", merged_into_code: "" },
        ],
      };
    case "template_member":
      return {
        sheet: "Sheet1",
        rows: [
          { "Member Type": "Actual", Member: 5800, Month: "Jan", Year: 2026 },
          { "Member Type": "Plan Renew", Member: 150, Month: "Jan", Year: 2026 },
          { "Member Type": "Plan Member New", Member: 60, Month: "Jan", Year: 2026 },
        ],
      };
    case "event":
    case "member":
    case "sponsor": {
      const program = slot === "event" ? "M-DB-Director Briefing" : slot === "member" ? "Member Fee - Annual New" : "CAC-Sponsorship";
      return {
        sheet: "Sheet1",
        csv: true,
        rows: [1, 2].map((i) => ({
          department: "Member",
          semi_Name: program,
          months: "March",
          regi_Name: `${program} 1/2026`,
          regi_startdate: "03/15/2026",
          pers_firstnameinthai: `ตัวอย่าง${i}`,
          pers_surnameinthai: "ทดสอบ",
          Comp_Name: `บริษัท ตัวอย่าง ${i} จำกัด`,
          AttendeeStatus: "Attended",
          Textbox34: "20-มี.ค.-26",
          Textbox40: slot === "sponsor" ? `RC00${i}` : "",
          atte_payment: slot === "event" ? "0" : "5,000.00",
          MemberType: "Juristic Member",
        })),
      };
    }
    default:
      throw new HttpError(404, "ไม่มีไฟล์ตัวอย่างสำหรับประเภทนี้");
  }
}

export const GET = route<RouteContext<"/api/upload/sample/[slot]">>(async (_req, ctx) => {
  await requireFeature("upload.create");
  const { slot } = await ctx.params;
  const def = SLOT_BY_KEY[slot];
  if (!def) throw new HttpError(404, "ไม่พบประเภทไฟล์");
  const s = sample(slot);
  const base = def.pattern.replace("*", "EXAMPLE").replace(/\s*&\s*/g, "_").replace(/\.xlsx$/, "");

  if (s.csv) {
    const body = `﻿${Papa.unparse(s.rows as Record<string, unknown>[])}`;
    return new Response(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(base)}.csv"`,
      },
    });
  }
  const wb = XLSX.utils.book_new();
  const ws = Array.isArray(s.rows[0])
    ? XLSX.utils.aoa_to_sheet(s.rows as unknown[][])
    : XLSX.utils.json_to_sheet(s.rows as Record<string, unknown>[]);
  XLSX.utils.book_append_sheet(wb, ws, s.sheet);
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(base)}.xlsx"`,
    },
  });
});
