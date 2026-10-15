"use client";

import { useEffect, useRef, useState } from "react";
import type { PageData } from "@/hooks/dashboard";
import { type ChartEntry, ENTRY_BY_ID } from "./chart-registry";
import { type Cell, SLIDE_H, SLIDE_W, type SlidePlan } from "./layout-engine";
import type { ExportTheme } from "./themes";

export interface ReportSettings {
  title: string;
  /** yyyy-mm-dd */
  date: string;
  logo: boolean;
  cover: boolean;
  pageNumbers: boolean;
  /** Current dashboard filters, shown on the cover and footer */
  filtersText: string;
}

export type ReportData = Partial<PageData>;

/* Slide geometry (px at 1600 × 900). Exporters reuse it to place native PowerPoint objects. */
export const MARGIN = 48;
export const HEADER_H = 56;
export const FOOTER_H = 36;
export const GAP = 20;
export const CONTENT = { x: MARGIN, y: MARGIN + HEADER_H + 16, w: SLIDE_W - MARGIN * 2, h: SLIDE_H - MARGIN * 2 - HEADER_H - 16 - FOOTER_H };
/** Inside a cell: padding and the title block above the chart. */
export const CELL_PAD = 20;
export const CELL_TITLE_H = 56;

export function cellRect(c: Cell) {
  const left = CONTENT.x + c.x * CONTENT.w + (c.x > 0 ? GAP / 2 : 0);
  const top = CONTENT.y + c.y * CONTENT.h + (c.y > 0 ? GAP / 2 : 0);
  const width = c.w * CONTENT.w - (c.x > 0 ? GAP / 2 : 0) - (c.x + c.w < 0.999 ? GAP / 2 : 0);
  const height = c.h * CONTENT.h - (c.y > 0 ? GAP / 2 : 0) - (c.y + c.h < 0.999 ? GAP / 2 : 0);
  return { left, top, width, height };
}

export const formatReportDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });

const fontFamily = "var(--font-sans)";

function Logo({ size }: { size: number }) {
  return (
    <span style={{ display: "inline-flex", width: size, height: size, alignItems: "center", justifyContent: "center", borderRadius: 10, background: "#ffffff", padding: 4 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- captured into the export, must be a plain img */}
      <img src="/brand/thai-iod-logo.png" alt="Thai Institute of Directors" width={size - 8} height={size - 8} />
    </span>
  );
}

/** One chart card on a slide. `data-cell` lets the PowerPoint exporter capture or replace it. */
function ChartCell({ entry, data, theme, cell }: { entry: ChartEntry; data: ReportData; theme: ExportTheme; cell: Cell }) {
  const r = cellRect(cell);
  const box = { w: Math.floor(r.width - CELL_PAD * 2), h: Math.floor(r.height - CELL_PAD * 2 - CELL_TITLE_H) };
  const d = data[entry.data];
  return (
    <div
      data-cell={entry.id}
      style={{
        position: "absolute",
        ...r,
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: 16,
        padding: CELL_PAD,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div style={{ height: CELL_TITLE_H }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: theme.text, lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{entry.title}</div>
        {entry.subtitle && <div style={{ fontSize: 14, color: theme.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{entry.subtitle}</div>}
      </div>
      <div data-chart style={{ width: box.w, height: box.h }}>
        {d ? entry.render(d as never, theme, box) : <div style={{ color: theme.muted, fontSize: 16 }}>ไม่มีข้อมูลสำหรับตัวกรองนี้</div>}
      </div>
    </div>
  );
}

/** A content slide at full export size (1600 × 900). */
export function SlideView({
  plan,
  data,
  theme,
  settings,
  page,
  pages,
}: {
  plan: SlidePlan;
  data: ReportData;
  theme: ExportTheme;
  settings: ReportSettings;
  /** 1-based page number among all slides (cover included) */
  page: number;
  pages: number;
}) {
  const sections = [...new Set(plan.ids.map((id) => ENTRY_BY_ID.get(id)?.section).filter(Boolean))].join(" · ");
  return (
    <div style={{ position: "relative", width: SLIDE_W, height: SLIDE_H, background: theme.bg, fontFamily, color: theme.text, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: SLIDE_W, height: 8, background: theme.accent }} />
      <div style={{ position: "absolute", left: MARGIN, top: MARGIN, right: MARGIN, height: HEADER_H, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: theme.text, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sections}</div>
          <div style={{ fontSize: 15, color: theme.muted }}>{settings.title}</div>
        </div>
        {settings.logo && <Logo size={HEADER_H} />}
      </div>
      {plan.cells.map((cell) => {
        const entry = ENTRY_BY_ID.get(cell.id);
        return entry ? <ChartCell key={cell.id} entry={entry} data={data} theme={theme} cell={cell} /> : null;
      })}
      <div
        style={{
          position: "absolute",
          left: MARGIN,
          right: MARGIN,
          bottom: MARGIN / 2,
          height: FOOTER_H,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 14,
          color: theme.muted,
        }}
      >
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {formatReportDate(settings.date)} · {settings.filtersText}
        </span>
        {settings.pageNumbers && <span style={{ fontVariantNumeric: "tabular-nums" }}>หน้า {page} / {pages}</span>}
      </div>
    </div>
  );
}

export function CoverSlide({ theme, settings, pages }: { theme: ExportTheme; settings: ReportSettings; pages: number }) {
  return (
    <div style={{ position: "relative", width: SLIDE_W, height: SLIDE_H, background: theme.accent, color: theme.onAccent, fontFamily, overflow: "hidden" }}>
      <div style={{ position: "absolute", right: -160, top: -160, width: 560, height: 560, borderRadius: 9999, background: theme.onAccent, opacity: 0.06 }} />
      <div style={{ position: "absolute", left: 120, top: 150, right: 120 }}>
        {settings.logo && <Logo size={120} />}
        <div style={{ marginTop: 48, fontSize: 22, letterSpacing: 4, opacity: 0.8 }}>IOD FINANCE INTELLIGENCE</div>
        <div style={{ marginTop: 12, fontSize: 64, fontWeight: 700, lineHeight: 1.3 }}>{settings.title}</div>
        <div style={{ marginTop: 20, width: 96, height: 6, borderRadius: 9999, background: theme.series[2] ?? theme.onAccent }} />
        <div style={{ marginTop: 28, fontSize: 24, opacity: 0.9 }}>{formatReportDate(settings.date)}</div>
        <div style={{ marginTop: 8, fontSize: 20, opacity: 0.75 }}>{settings.filtersText}</div>
      </div>
      {settings.pageNumbers && <div style={{ position: "absolute", right: MARGIN, bottom: MARGIN / 2 + 8, fontSize: 14, opacity: 0.7 }}>หน้า 1 / {pages}</div>}
    </div>
  );
}

/** Shows a full-size slide shrunk to the width of its container (live preview / thumbnails). */
export function Scaled({ width = SLIDE_W, height = SLIDE_H, children }: { width?: number; height?: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={ref} style={{ position: "relative", width: "100%", aspectRatio: `${width} / ${height}`, overflow: "hidden" }}>
      {scale > 0 && <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "0 0", pointerEvents: "none" }}>{children}</div>}
    </div>
  );
}
