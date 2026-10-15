---
name: "iod-design-system"
description: "Use when building or changing any UI, component, page layout or Recharts chart in the IOD Finance Portal, so tokens, Thai typography and chart styling stay consistent."
---

# IOD Finance Portal: Design System

Stack: Next.js App Router, Tailwind v4, shadcn/ui, lucide-react, Recharts. UI language is Thai; code is English.

## Ground rules
- Never copy `reference/iod-dashboard.html`. The approved look (after the MOM review) is the **IOD Finance Intelligence** brand: navy / gray / white, the IOD logo (`public/brand/`), logo red as the only accent. Don't introduce new brand colors.
- Never hard-code hex values, px spacing or font names inside components. Use tokens only (the few hex values in `globals.css` theme blocks and the 5 status-coloured insight/summary cards are the known exceptions).
- Reuse the primitives in `src/components/ui/` (Button, Card, Badge, Dialog, form fields, `IconBadge`, `PageHeader`, `PageGuide`, `InfoTip`, `SortTh`/`useSort`, `Reveal`) and the dashboard widgets (`Panel`, `MetricPanel`, `StatCard`, `TreeTable`); wrap them, don't fork their styles per page.

## Tokens (single source: `src/app/globals.css`)
- **Theme scale:** everything themable uses `navy-50 … navy-950` (`--color-navy-*`). The 5 user themes (navy, teal, burgundy, forest, graphite; MOM G4) swap that scale via `[data-theme=…]`, so a component built on `navy-*` changes with the theme automatically. Never use other hue scales (sky, violet, …) for frames, buttons or headers.
- **Other roles:** `--color-background`, `--color-foreground`, `--color-card`, `--color-border`, `--color-muted(-foreground)`, `--color-accent` (logo red, sparingly), plus status `--color-success`, `--color-warning`, `--color-danger` (each with `-soft`). Status colours keep their meaning across themes.
- **Gradients:** theme-tone only (`navy-*` stops). Helpers: `.gradient-border` (thin 1px theme frame, default on `Card`), `.text-gradient`, `.hero-mesh`, `.lift` (hover). Frames stay thin and light.
- **Motion:** `Reveal` for scroll-in cards. Every animation must be disabled under `prefers-reduced-motion`, and content must be visible in print.
- **Day / night mode:** `html[data-mode="dark"]` (moon/sun button next to the profile, saved per browser). `globals.css` remaps surface tokens and the common light utilities (`bg-white`, `bg-navy-50/100`, `text-navy-700…950`, light gradient stops). New components: prefer tokens (`bg-card`, `text-foreground`, `border-border`) and check both modes. Chart neutrals use `--chart-grid`, `--chart-axis`, `--chart-line-*`.
- **Custom theme:** `data-theme="custom"` mixes the whole `navy-*` scale from one `--theme-base` colour (the "+" in the theme row).
- Severity mapping for IssueLog: critical -> danger (solid), high -> danger (soft), medium -> warning, low -> info. Always pair color with an icon or text label.
- Spacing: 4px base scale (4, 8, 12, 16, 24, 32, 48). Radius: one small and one medium value only.
- Elevation: at most 2 levels. Prefer borders over shadows for dense finance tables.

## Typography (Thai first)
- The app uses **IBM Plex Sans Thai** via `next/font` (`--font-plex-thai`, weights 400–700). Don't add another family.
- Body >= 16px, line-height >= 1.6 (Thai tone marks and vowels collide at tight leading). Headings line-height >= 1.3.
- Never letter-space Thai text. Never use text-align: justify for Thai.
- Numbers: `font-variant-numeric: tabular-nums` in tables, KPIs, axes.
- Use the helpers in `src/lib/utils.ts`: `formatTHB`, `formatMB` (ล้านบาท, as in the Power BI reports), `formatPercent`, `formatDate`, `formatPeriod`. Dates shown to users use the **Buddhist year** (e.g. ส.ค. 2569); data/API values stay Gregorian (`2026-08`).

## Components & layout
- App shell is decided (MOM N1–N10): collapsible sidebar + top bar with breadcrumbs and profile menu, all in `src/components/layout/app-frame.tsx`. Menu items live in `src/components/layout/nav.ts`; change navigation there only.
- Page anatomy: page title, one-line purpose, primary action (one per page), content. Cards group related KPIs; do not nest cards.
- States are mandatory for every data component: loading (skeleton), empty, error (with retry), partial/stale data.
- Responsive: design mobile first; tables become stacked cards or horizontal scroll with a sticky first column below 768px.

## Charts (Recharts)
- Pick the form from the question: trend over time -> line; compare categories -> bar (sorted); budget vs actual -> bar plus target line. Pies/donuts only where the signed Business Blueprint asks for them (e.g. Expenditure by Department); never 3D.
- Chart colours come from `src/components/charts/theme.ts` (`CHART`, built on `navy-*` so charts follow the theme) and `PIE_COLORS`. Revenue / expense / budget keep the same colour on every chart.
- Do not rely on color alone: add direct labels or legend plus pattern/marker; add `aria-label` and a visually-hidden table or summary of the data.
- Axis: THB with thousands separators, zero baseline for bars, light gridlines, no chart junk. Tooltips show period, category, exact value and variance vs budget.
- Thresholds from AlertThreshold render as a dashed reference line with a text label.

## Definition of done
- No raw colors/sizes in diff (`grep` for `#[0-9a-f]{3,6}` and `px` in components).
- Checked at 375px / 768px / 1280px and with at least one other theme (e.g. Teal); print/Export PDF still shows all content.
- Loading, empty, error states exist.
- Hand off to `iod-ux-quality` for the content and accessibility pass.