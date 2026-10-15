"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatMB } from "@/lib/utils";
import { Panel } from "./widgets";

export const PIE_COLORS = [
  "var(--color-navy-900)",
  "var(--color-navy-700)",
  "var(--color-navy-500)",
  "var(--color-navy-400)",
  "var(--color-navy-300)",
  "#98a2b3",
  "#667085",
  "var(--color-navy-200)",
  "var(--color-navy-600)",
  "#d0d5dd",
];

export function PiePanel({
  title,
  subtitle,
  data,
  info,
  onSelect,
}: {
  title: string;
  subtitle?: string;
  data: { name: string; value: number }[];
  info?: string;
  /** Click a slice to filter the whole page by it (MOM D6). */
  onSelect?: (name: string) => void;
}) {
  const total = data.reduce((s, x) => s + x.value, 0);
  const sorted = [...data].sort((a, b) => b.value - a.value);
  return (
    <Panel title={title} subtitle={onSelect ? `${subtitle ?? ""} · คลิกส่วนของกราฟเพื่อกรอง`.replace(/^ · /, "") : subtitle} info={info}>
      {sorted.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูลในช่วงนี้</p>
      ) : (
        <div className="chart-box h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sorted}
                dataKey="value"
                nameKey="name"
                innerRadius="45%"
                outerRadius="78%"
                paddingAngle={1}
                label={({ value }) => {
                  const share = (Number(value) / total) * 100;
                  return share >= 4 ? `${share.toFixed(0)}%` : "";
                }}
                labelLine={false}
                className={onSelect ? "cursor-pointer" : undefined}
                onClick={(entry) => {
                  const name = (entry as unknown as { name?: string }).name;
                  if (name && onSelect) onSelect(name);
                }}
              >
                {sorted.map((x, i) => (
                  <Cell key={x.name} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#fff" />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `${formatMB(Number(v))} MB`} />
              <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
