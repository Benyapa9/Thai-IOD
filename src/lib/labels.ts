import type {
  Category,
  FeedbackStatus,
  FeedbackType,
  IssueCategory,
  IssueStatus,
  OutcomeResult,
  RecordType,
  Role,
  Severity,
} from "@/types/domain";

export const CATEGORY_LABEL: Record<Category, string> = {
  training: "หลักสูตรอบรม",
  membership: "สมาชิก",
  sponsorship: "สปอนเซอร์",
  corporate: "องค์กร",
};

export const RECORD_TYPE_LABEL: Record<RecordType, string> = {
  revenue: "รายได้",
  expense: "ค่าใช้จ่าย",
  budget: "งบประมาณ",
};

export const ROLE_LABEL: Record<Role, string> = {
  basic: "Basic",
  standard: "Standard",
  advanced: "Advanced",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "วิกฤต",
  high: "สูง",
  medium: "ปานกลาง",
  low: "ต่ำ",
};

export const ISSUE_CATEGORY_LABEL: Record<IssueCategory, string> = {
  budget: "งบประมาณ",
  revenue: "รายได้",
  compliance: "Compliance",
  system: "ระบบ",
  other: "อื่น ๆ",
};

export const ISSUE_STATUS_LABEL: Record<IssueStatus, string> = {
  open: "เปิด",
  in_progress: "กำลังดำเนินการ",
  resolved: "แก้ไขแล้ว",
  closed: "ปิด",
};

export const OUTCOME_RESULT_LABEL: Record<OutcomeResult, string> = {
  pending: "รอประเมินผล",
  improved: "ดีขึ้นตามเป้า",
  not_improved: "ยังไม่ดีขึ้น",
};

export const FEEDBACK_TYPE_LABEL: Record<FeedbackType, string> = {
  issue: "แจ้งปัญหา (Issue)",
  new_request: "ขอฟีเจอร์ / Dashboard ใหม่",
  insight_request: "ขอ Insight เพิ่ม",
  page_feedback: "ความเห็นต่อหน้าเว็บ",
};

export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = {
  open: "รับเรื่องแล้ว",
  in_review: "กำลังพิจารณา",
  done: "ดำเนินการแล้ว",
};
