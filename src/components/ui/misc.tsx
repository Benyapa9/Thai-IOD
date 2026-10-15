import { Inbox, type LucideIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type IconTone = "navy" | "blue" | "green" | "red" | "amber" | "violet" | "teal" | "slate" | "pink";

/** Gradient tiles like the Home quick-access icons; theme tones follow the selected colour theme. */
const TONE: Record<IconTone, string> = {
  navy: "from-navy-900 to-navy-500",
  blue: "from-navy-800 to-navy-400",
  teal: "from-navy-700 to-navy-400",
  violet: "from-navy-950 to-navy-600",
  slate: "from-navy-600 to-navy-300",
  green: "from-emerald-700 to-emerald-400",
  red: "from-rose-700 to-rose-400",
  amber: "from-amber-600 to-amber-400",
  pink: "from-rose-600 to-pink-400",
};
const BADGE_SIZE = {
  sm: "size-7 rounded-lg [&_svg]:size-3.5",
  md: "size-9 rounded-xl [&_svg]:size-[18px]",
  lg: "size-11 rounded-xl [&_svg]:size-[22px]",
};

/** Gradient tile with an icon — used on page headers, cards and panels. */
export function IconBadge({
  icon: Icon,
  tone = "navy",
  size = "md",
  className,
}: {
  icon: LucideIcon;
  tone?: IconTone;
  size?: keyof typeof BADGE_SIZE;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center bg-gradient-to-br text-white shadow-sm ring-1 ring-white/30", TONE[tone], BADGE_SIZE[size], className)}
      aria-hidden
    >
      <Icon />
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  icon,
  tone = "navy",
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  icon?: LucideIcon;
  tone?: IconTone;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {icon && <IconBadge icon={icon} tone={tone} size="lg" />}
        <div className="min-w-0">
          <h1 className="text-2xl leading-tight font-semibold text-navy-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Section title inside a page, with an optional icon. */
export function SectionTitle({ icon, tone = "navy", children, aside }: { icon?: LucideIcon; tone?: IconTone; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2.5">
      {icon && <IconBadge icon={icon} tone={tone} size="sm" />}
      <h2 className="text-base font-semibold text-navy-900">{children}</h2>
      {aside && <div className="ml-auto">{aside}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin text-navy-500", className)} />;
}

export function LoadingBlock({ label = "กำลังโหลดข้อมูล…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Spinner /> {label}
    </div>
  );
}

export function ErrorBlock({ error }: { error: unknown }) {
  return (
    <div className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
      {error instanceof Error ? error.message : "เกิดข้อผิดพลาด"}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center">
      <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-navy-50 text-navy-400">
        <Inbox className="size-6" />
      </span>
      <p className="font-medium text-navy-900">{title}</p>
      {children && <div className="mt-1 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-border bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
            value === o.value ? "bg-navy-900 text-white" : "text-navy-700 hover:bg-navy-50",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
