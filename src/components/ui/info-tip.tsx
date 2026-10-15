import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/** Hover / focus explanation bubble (MOM I3, D5). Pure CSS so it works anywhere. */
export function InfoTip({
  children,
  className,
  side = "bottom",
  align = "center",
  label = "คำอธิบาย",
}: {
  children: React.ReactNode;
  className?: string;
  side?: "bottom" | "top";
  /** "end" for icons near the right edge of a card or the screen. */
  align?: "center" | "start" | "end";
  label?: string;
}) {
  return (
    <span className={cn("group/tip relative inline-flex align-middle", className)}>
      <button type="button" aria-label={label} className="rounded-full text-current opacity-60 hover:opacity-100 focus:opacity-100 cursor-help">
        <Info className="size-3.5" />
      </button>
      {/* display:none while hidden, so the bubble never widens the page. */}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-40 hidden w-64 max-w-[80vw] rounded-md bg-navy-950 px-3 py-2 text-left text-xs leading-relaxed font-normal text-white shadow-lg group-hover/tip:block group-focus-within/tip:block",
          side === "bottom" ? "top-full mt-1.5" : "bottom-full mb-1.5",
          align === "center" && "left-1/2 -translate-x-1/2",
          align === "start" && "left-0",
          align === "end" && "right-0",
        )}
      >
        {children}
      </span>
    </span>
  );
}
