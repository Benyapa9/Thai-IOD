"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts";
import { formatMB } from "@/lib/utils";
import type { ExportTheme } from "./themes";

/*
 * Chart building blocks for exported slides. They draw at a fixed pixel size
 * (no ResponsiveContainer) with animation off, so a capture is sharp and
 * identical on every screen, and they take every colour from the export theme.
 */

export interface Box {
  w: number;
  h: number;
}

const fmtAxis = (v: number) => formatMB(Number(v), 0);
const fmtVal = (v: unknown) => (v === null || v === undefined ? "-" : `${formatMB(Number(v))}`);

function axis(theme: ExportTheme, fontSize: number) {
  return { stroke: theme.muted, tick: { fill: theme.muted, fontSize }, tickLine: false, axisLine: { stroke: theme.grid } } as const;
}
const fontFor = (box: Box) => Math.max(11, Math.min(16, Math.round(box.w / 70)));

export interface SeriesDef {
  key: string;
  name: string;
  /** index into theme.series, or an explicit colour */
  color?: number | string;
  dashed?: boolean;
  stack?: string;
}
const colorOf = (theme: ExportTheme, c: number | string | undefined, i: number) =>
  typeof c === "string" ? c : theme.series[(c ?? i) % theme.series.length];

export function ExportBars({
  data,
  category,
  series,
  theme,
  box,
  horizontal = false,
}: {
  data: Record<string, unknown>[];
  category: string;
  series: SeriesDef[];
  theme: ExportTheme;
  box: Box;
  horizontal?: boolean;
}) {
  const fs = fontFor(box);
  return (
    <BarChart width={box.w} height={box.h} data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
      <CartesianGrid stroke={theme.grid} vertical={horizontal} horizontal={!horizontal} />
      {horizontal ? (
        <>
          <XAxis type="number" {...axis(theme, fs)} tickFormatter={fmtAxis} />
          <YAxis type="category" dataKey={category} {...axis(theme, fs)} width={Math.min(240, box.w * 0.3)} interval={0} />
        </>
      ) : (
        <>
          <XAxis dataKey={category} {...axis(theme, fs)} interval={0} />
          <YAxis {...axis(theme, fs)} tickFormatter={fmtAxis} width={52} />
        </>
      )}
      {series.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: fs, color: theme.text }} />}
      {series.map((s, i) => (
        <Bar
          key={s.key}
          dataKey={s.key}
          name={s.name}
          stackId={s.stack}
          fill={colorOf(theme, s.color, i)}
          radius={s.stack ? 0 : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
          isAnimationActive={false}
        />
      ))}
    </BarChart>
  );
}

export function ExportLines({
  data,
  category,
  series,
  theme,
  box,
}: {
  data: Record<string, unknown>[];
  category: string;
  series: SeriesDef[];
  theme: ExportTheme;
  box: Box;
}) {
  const fs = fontFor(box);
  return (
    <LineChart width={box.w} height={box.h} data={data} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
      <CartesianGrid stroke={theme.grid} vertical={false} />
      <XAxis dataKey={category} {...axis(theme, fs)} />
      <YAxis {...axis(theme, fs)} tickFormatter={fmtAxis} width={52} domain={["auto", "auto"]} />
      <Legend iconType="circle" wrapperStyle={{ fontSize: fs, color: theme.text }} />
      {series.map((s, i) => (
        <Line
          key={s.key}
          dataKey={s.key}
          name={s.name}
          type="monotone"
          stroke={colorOf(theme, s.color, i)}
          strokeWidth={s.dashed ? 2 : 3}
          strokeDasharray={s.dashed ? "6 4" : undefined}
          dot={s.dashed ? false : { r: 3.5, fill: colorOf(theme, s.color, i), strokeWidth: 0 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      ))}
    </LineChart>
  );
}

export function ExportPie({ data, theme, box, donut = true }: { data: { name: string; value: number }[]; theme: ExportTheme; box: Box; donut?: boolean }) {
  const fs = fontFor(box);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = Math.min(box.h * 0.42, box.w * 0.22);
  return (
    <PieChart width={box.w} height={box.h}>
      <Pie
        data={data}
        dataKey="value"
        nameKey="name"
        cx={box.w * 0.3}
        cy="50%"
        outerRadius={r}
        innerRadius={donut ? r * 0.58 : 0}
        stroke={theme.surface}
        strokeWidth={2}
        isAnimationActive={false}
      >
        {data.map((_, i) => (
          <Cell key={i} fill={theme.series[i % theme.series.length]} />
        ))}
      </Pie>
      <Legend
        layout="vertical"
        align="right"
        verticalAlign="middle"
        iconType="circle"
        wrapperStyle={{ fontSize: fs, color: theme.text, width: box.w * 0.42 }}
        formatter={(name: string, entry) => {
          const v = Number((entry?.payload as { value?: number } | undefined)?.value ?? 0);
          return `${name} · ${((v / total) * 100).toFixed(1)}%`;
        }}
      />
    </PieChart>
  );
}

/** Actual vs plan card (Main L001–L003 style). */
export function ExportKpi({
  label,
  actual,
  plan,
  achievePct,
  extra,
  theme,
  box,
  invert = false,
}: {
  label: string;
  actual: number;
  plan: number;
  achievePct: number;
  extra?: { label: string; value: string }[];
  theme: ExportTheme;
  box: Box;
  /** expenses: going over plan is bad */
  invert?: boolean;
}) {
  const good = invert ? actual <= plan : actual >= plan;
  const scale = Math.max(0.7, Math.min(1.4, box.h / 380));
  const pctBar = Math.max(0, Math.min(100, achievePct));
  return (
    <div style={{ display: "flex", height: "100%", flexDirection: "column", justifyContent: "center", gap: 14 * scale, color: theme.text }}>
      <div style={{ fontSize: 16 * scale, color: theme.muted }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontSize: 56 * scale, fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{formatMB(actual)}</span>
        <span style={{ fontSize: 18 * scale, color: theme.muted }}>MB</span>
      </div>
      <div style={{ fontSize: 15 * scale, color: theme.muted }}>
        แผน {formatMB(plan)} MB ·{" "}
        <b style={{ color: good ? theme.positive : theme.negative }}>
          {achievePct.toFixed(1)}% ของแผน
        </b>
      </div>
      <div style={{ height: 10 * scale, borderRadius: 999, background: theme.grid, overflow: "hidden" }}>
        <div style={{ width: `${pctBar}%`, height: "100%", borderRadius: 999, background: good ? theme.series[0] : theme.negative }} />
      </div>
      {extra && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${extra.length}, 1fr)`, gap: 10, marginTop: 4 * scale }}>
          {extra.map((e) => (
            <div key={e.label} style={{ borderRadius: 10, background: theme.bg, padding: `${8 * scale}px ${10 * scale}px` }}>
              <div style={{ fontSize: 12 * scale, color: theme.muted }}>{e.label}</div>
              <div style={{ fontSize: 20 * scale, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{e.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** A few big numbers in a row (counts). */
export function ExportStats({ items, theme, box }: { items: { label: string; value: string }[]; theme: ExportTheme; box: Box }) {
  const cols = items.length > 4 ? 3 : items.length > 2 ? 2 : items.length;
  const scale = Math.max(0.7, Math.min(1.3, box.h / 360));
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12, height: "100%", alignContent: "center", color: theme.text }}>
      {items.map((it) => (
        <div key={it.label} style={{ borderRadius: 12, background: theme.bg, padding: 14 * scale }}>
          <div style={{ fontSize: 14 * scale, color: theme.muted }}>{it.label}</div>
          <div style={{ fontSize: 34 * scale, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}

export interface TableCol<R> {
  label: string;
  value: (r: R) => string;
  align?: "left" | "right";
  tone?: (r: R) => "pos" | "neg" | null;
  bold?: (r: R) => boolean;
}

/** Table that shows as many rows as fit and says how many were left out. */
export function ExportTable<R>({ rows, cols, theme, box }: { rows: R[]; cols: TableCol<R>[]; theme: ExportTheme; box: Box }) {
  const fs = Math.max(12, Math.min(16, Math.round(box.h / 34)));
  const rowH = fs * 2.05;
  const fit = Math.max(1, Math.floor((box.h - rowH - fs * 2) / rowH));
  const shown = rows.slice(0, fit);
  const hidden = rows.length - shown.length;
  return (
    <div style={{ fontSize: fs, color: theme.text }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th
                key={c.label}
                style={{ textAlign: c.align ?? "left", padding: `0 8px`, height: rowH, color: theme.onAccent, background: theme.accent, fontWeight: 600, whiteSpace: "nowrap" }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={i} style={{ background: i % 2 ? theme.bg : theme.surface }}>
              {cols.map((c) => {
                const tone = c.tone?.(r);
                return (
                  <td
                    key={c.label}
                    style={{
                      textAlign: c.align ?? "left",
                      padding: "0 8px",
                      height: rowH,
                      borderBottom: `1px solid ${theme.grid}`,
                      color: tone === "pos" ? theme.positive : tone === "neg" ? theme.negative : theme.text,
                      fontWeight: c.bold?.(r) ? 700 : 400,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: c.align === "right" ? undefined : box.w * 0.4,
                    }}
                  >
                    {c.value(r)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {hidden > 0 && <div style={{ marginTop: 6, color: theme.muted, fontSize: fs * 0.85 }}>… และอีก {hidden} รายการ (ดูทั้งหมดได้ใน Dashboard)</div>}
    </div>
  );
}

export { fmtVal };
