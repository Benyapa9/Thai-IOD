"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { FloatingAssistant } from "@/components/assistant/floating-assistant";
import { TourPlayer } from "@/components/tour/tour-player";
import { ConsentDialog } from "./consent-dialog";
import { LoadingIndicator } from "./loading-indicator";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { useCan, useT } from "./user-context";

/** Page view for My Usage Log (MOM F4). */
function useUsageTracking() {
  const pathname = usePathname();
  useEffect(() => {
    const t = setTimeout(() => {
      void fetch("/api/usage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: pathname }) });
    }, 800);
    return () => clearTimeout(t);
  }, [pathname]);
}

export function AppFrame({
  demo,
  signOutAction,
  children,
}: {
  demo: boolean;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const t = useT();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const params = useSearchParams();
  const canChat = useCan("agent.chat");
  useUsageTracking();

  return (
    <>
      {/* Made inert by the product tour while it is open. */}
      <div id="app-shell">
      <Sidebar signOutAction={signOutAction} />
      <div className={cn("min-w-0 transition-[padding] duration-200", collapsed ? "lg:pl-[68px]" : "lg:pl-60")}>
        <Topbar signOutAction={signOutAction} />
        {demo && (
          <div className="no-print border-b border-navy-200 bg-navy-50 px-4 py-1.5 text-center text-xs text-navy-700 lg:px-8">
            {t("nav.demoBanner")}
          </div>
        )}
        {params.get("denied") === "1" && (
          <div className="no-print mx-auto mt-4 max-w-7xl px-4 lg:px-8">
            <div className="rounded-md border border-warning/30 bg-warning-soft px-4 py-2 text-sm text-warning">{t("nav.denied")}</div>
          </div>
        )}
        <main className="mx-auto max-w-7xl px-3 py-5 sm:px-4 lg:px-8">{children}</main>
      </div>
      <ConsentDialog />
      <LoadingIndicator />
      {canChat && <FloatingAssistant />}
      </div>
      <TourPlayer />
    </>
  );
}
