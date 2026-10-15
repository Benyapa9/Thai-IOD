---
name: "iod-ux-quality"
description: "Use to write or review Thai UI copy, run a usability heuristics check, or audit accessibility (WCAG 2.2 AA) of pages and components in the IOD Finance Portal before a demo or merge."
---

# IOD Finance Portal: UX Quality Gate

Three passes: A) Thai UX writing, B) usability heuristics, C) accessibility. Run the ones requested; for a pre-demo review run all three. Users are Thai finance staff, managers and CFO, mostly non-technical. Report findings as: severity, page/component, issue, recommended fix (with proposed Thai copy where relevant).

## A. Thai UX writing
Voice: professional, polite, calm, plain. Short sentences. No slang, no English where a clear Thai word exists (keep established terms such as KPI, Dashboard, Excel, CSV).
- Use one consistent politeness level. Prefer neutral "กรุณา..." for requests; avoid mixing ครับ/ค่ะ; address the user directly without stacking pronouns.
- Buttons are verb + object: "อัปโหลดไฟล์", "บันทึกความเห็น", "สร้างประเด็นใหม่". Avoid "ตกลง"/"OK" alone. Destructive actions name the thing: "ลบประเด็นนี้".
- Error message pattern = what happened + why (if known) + what to do next. Never blame the user or show codes alone.
  - Bad: "Upload failed (500)". Good: "อัปโหลดไฟล์ไม่สำเร็จ ระบบไม่สามารถอ่านไฟล์นี้ได้ กรุณาตรวจสอบว่าเป็นไฟล์ .xlsx หรือ .csv แล้วลองอีกครั้ง"
- Validation: say the rule, next to the field ("รหัสงวด ต้องอยู่ในรูปแบบ 2026-01"). Point to the exact row/column for file errors ("แถวที่ 14 คอลัมน์ amount: ไม่ใช่ตัวเลข").
- Empty states explain the value and the next action with a button ("ยังไม่มีข้อมูลงบประมาณ เริ่มต้นด้วยการอัปโหลดไฟล์ประจำเดือน").
- Success messages confirm the result with specifics ("อัปโหลดสำเร็จ 128 รายการ ประมวลผลงวด 2026-08").
- Permissions: when a user's level lacks access, say which level can and how to get it ("ฟังก์ชันนี้สำหรับผู้ใช้ระดับ Standard ขึ้นไป ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์") instead of a blank page or 403. Levels are Basic / Standard / Advanced, not job titles.
- Loading text for long jobs says what is happening and that the user can wait.
- Numbers, currency and dates formatted consistently (th-TH, THB, one calendar-year convention). Keep all strings in one i18n/message file, not scattered in JSX.
- AI assistant: label as an assistant, show it can be wrong, cite which data period it used.

## B. Usability heuristics (Nielsen, applied)
Check each page against:
1. Visibility of status: loading, saving, uploaded, processed, last data refresh time shown.
2. Match with the real world: finance/IOD vocabulary, not DB field names ("รายได้" not "revenue" if the audience is Thai staff).
3. User control: undo or confirm for delete; cancel on dialogs; leave upload mid-way safely.
4. Consistency: same action = same label, icon, position on every page; severity and status colors match across charts, badges, tables.
5. Error prevention: disable invalid actions, sensible defaults, file type hints before upload, preview before committing data, confirm overwrites.
6. Recognition over recall: visible filters, breadcrumbs/active nav state, remembered last period.
7. Efficiency: keyboard shortcuts for power users, saved views, bulk actions in the issue log.
8. Minimal design: one primary action per screen; KPI first, detail on demand; progressive disclosure for scenario levers.
9. Error recovery: clear messages (see A), retry, preserved form input.
10. Help: inline hints, tooltips on KPI definitions (how is NOI / budget variance calculated), short onboarding for first login.
Also check: the 5-second test per page (what is it, what can I do), level-appropriate views (Basic / Standard / Advanced, and department-restricted users), and mobile task flow for the CFO checking KPIs on a phone.

## C. Accessibility (WCAG 2.2 AA)
Automated first: `eslint-plugin-jsx-a11y`, `axe-core` (or `@axe-core/playwright`), Lighthouse. Then manual:
- Document: `<html lang="th">`, one `<h1>` per page, logical headings, landmarks (`header`, `nav`, `main`), skip-to-content link, unique page `<title>`.
- Contrast: text >= 4.5:1 (large 3:1), UI components and chart marks >= 3:1, in light and dark. Check placeholder, disabled-but-informative and badge text.
- Keyboard: everything reachable and operable, logical tab order, no traps, visible focus ring (>= 2px, 3:1), focus not hidden by sticky headers (2.4.11). Dialogs/sheets trap focus, close on Esc, return focus. Custom selects/menus follow ARIA patterns (prefer shadcn/Radix defaults).
- Targets: pointer targets >= 24x24 CSS px (2.5.8); aim for 44px on touch. No drag-only interactions: sliders in Scenario Planning need keyboard and numeric input alternatives (2.5.7).
- Forms (react-hook-form): visible `<label>` bound by `htmlFor`; errors linked with `aria-describedby`, `aria-invalid`, announced via `aria-live`/focus the first error; required marked in text, not color only; do not ask the same data twice (3.3.7); `autocomplete` where relevant.
- Charts and tables: text alternative or accessible data table for every chart; do not encode meaning by color alone; tooltips available on focus not just hover; real `<table>` with `<th scope>` and `<caption>`.
- Status messages (upload progress, toast, alerts) use `role="status"` / `role="alert"` appropriately; toasts do not vanish before they can be read.
- Motion: respect `prefers-reduced-motion`; no auto-playing animation > 5s; content works at 200% zoom and 320px width (reflow) and with text spacing overrides.
- Thai text: body >= 16px, line-height >= 1.6, no justified text; allow wrapping without clipping tone marks (no tight `line-height` or `overflow:hidden` on single-line labels); avoid truncating Thai mid-word, prefer wrapping or `Intl.Segmenter`-aware truncation; test with a screen reader that supports Thai (NVDA, VoiceOver).
- Images/icons: meaningful ones have alt text; decorative `aria-hidden`; icon-only buttons have `aria-label`.

## Output
1. Summary table: Pass | Fail | Needs manual check for A, B, C.
2. Findings list sorted by severity with proposed fixes and Thai copy.
3. A "fix before demo" shortlist (max 5 items) that most improves the client's first impression.