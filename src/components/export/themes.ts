/**
 * Colour themes for exported reports. Exports need concrete colours (PowerPoint
 * native charts cannot read CSS variables), so this is the one place in the app
 * with a hex palette outside globals.css — the "brand" theme mirrors the Navy tokens.
 */
export interface ExportTheme {
  id: string;
  name: string;
  /** Slide background */
  bg: string;
  /** Card background on the slide */
  surface: string;
  border: string;
  text: string;
  muted: string;
  grid: string;
  /** Header bar, titles, primary series */
  accent: string;
  /** Text on the accent colour */
  onAccent: string;
  /** Chart series, in order (index 0 = Actual / main series) */
  series: string[];
  positive: string;
  negative: string;
}

const BRAND: ExportTheme = {
  id: "brand",
  name: "ธีมแบรนด์ (Navy)",
  bg: "#f5f7fb",
  surface: "#ffffff",
  border: "#dfe3ea",
  text: "#132642",
  muted: "#667085",
  grid: "#e4e7ec",
  accent: "#132642",
  onAccent: "#ffffff",
  series: ["#1d3354", "#7392bd", "#c0262d", "#a3bad8", "#3a5985", "#98a2b3"],
  positive: "#17714a",
  negative: "#b42318",
};

export const EXPORT_THEMES: ExportTheme[] = [
  BRAND,
  {
    id: "light",
    name: "สว่าง",
    bg: "#ffffff",
    surface: "#ffffff",
    border: "#e5e7eb",
    text: "#111827",
    muted: "#6b7280",
    grid: "#eef0f3",
    accent: "#2563eb",
    onAccent: "#ffffff",
    series: ["#2563eb", "#93c5fd", "#f59e0b", "#10b981", "#8b5cf6", "#9ca3af"],
    positive: "#059669",
    negative: "#dc2626",
  },
  {
    id: "dark",
    name: "มืด",
    bg: "#0c121e",
    surface: "#151d2c",
    border: "#283247",
    text: "#e8edf6",
    muted: "#9aa5b8",
    grid: "#263044",
    accent: "#7aa2ff",
    onAccent: "#0c121e",
    series: ["#7aa2ff", "#4b6cb7", "#ff6b72", "#f5b544", "#4cc98a", "#9aa5b8"],
    positive: "#4cc98a",
    negative: "#f97066",
  },
  {
    id: "mono",
    name: "โทนเดียว (Monochrome)",
    bg: "#ffffff",
    surface: "#ffffff",
    border: "#d4d4d4",
    text: "#171717",
    muted: "#737373",
    grid: "#e5e5e5",
    accent: "#262626",
    onAccent: "#ffffff",
    series: ["#262626", "#737373", "#a3a3a3", "#525252", "#d4d4d4", "#404040"],
    positive: "#262626",
    negative: "#525252",
  },
  {
    id: "ocean",
    name: "พาเลตต์ Ocean",
    bg: "#f0f7fa",
    surface: "#ffffff",
    border: "#cfe3ea",
    text: "#0b3a4a",
    muted: "#5b7a86",
    grid: "#dfecf1",
    accent: "#0e7490",
    onAccent: "#ffffff",
    series: ["#0e7490", "#38bdf8", "#f97316", "#14b8a6", "#6366f1", "#94a3b8"],
    positive: "#0f766e",
    negative: "#c2410c",
  },
  {
    id: "sunset",
    name: "พาเลตต์ Sunset",
    bg: "#fff8f3",
    surface: "#ffffff",
    border: "#f3dccb",
    text: "#3b1d0f",
    muted: "#8a6a58",
    grid: "#f5e7dc",
    accent: "#c2410c",
    onAccent: "#ffffff",
    series: ["#c2410c", "#fb923c", "#be185d", "#facc15", "#7c3aed", "#a8a29e"],
    positive: "#15803d",
    negative: "#b91c1c",
  },
  {
    id: "forest",
    name: "พาเลตต์ Forest",
    bg: "#f3f8f4",
    surface: "#ffffff",
    border: "#d3e5d8",
    text: "#14301f",
    muted: "#5f7a68",
    grid: "#e1eee4",
    accent: "#2f6c4b",
    onAccent: "#ffffff",
    series: ["#2f6c4b", "#8fc3a4", "#d97706", "#3f875f", "#0e7490", "#9ca3af"],
    positive: "#2f6c4b",
    negative: "#b42318",
  },
  {
    id: "berry",
    name: "พาเลตต์ Berry",
    bg: "#fbf5f8",
    surface: "#ffffff",
    border: "#ecd7e2",
    text: "#3a1028",
    muted: "#83647a",
    grid: "#f3e4ec",
    accent: "#9d174d",
    onAccent: "#ffffff",
    series: ["#9d174d", "#f472b6", "#6d28d9", "#f59e0b", "#0891b2", "#a1a1aa"],
    positive: "#047857",
    negative: "#be123c",
  },
];

/** Theme with the user's accent colour applied (header, titles and the main series). */
export function withAccent(theme: ExportTheme, accent: string | null): ExportTheme {
  if (!accent) return theme;
  const onAccent = luminance(accent) > 0.55 ? "#111111" : "#ffffff";
  return { ...theme, accent, onAccent, series: [accent, ...theme.series.slice(1)] };
}

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** "#rrggbb" → "rrggbb" for pptxgenjs. */
export const pptColor = (hex: string) => hex.replace("#", "").toUpperCase();
