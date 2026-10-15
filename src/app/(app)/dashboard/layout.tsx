import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingBlock } from "@/components/ui/misc";
import { guardRoute } from "@/server/page-guard";
import { DashboardShell } from "./dashboard-shell";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  await guardRoute("/dashboard");
  return (
    <Suspense fallback={<LoadingBlock />}>
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}
