import { redirect } from "next/navigation";

export default async function DashboardIndex({ searchParams }: PageProps<"/dashboard">) {
  const params = new URLSearchParams(
    Object.entries(await searchParams).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])),
  );
  redirect(`/dashboard/main/kpi${params.size ? `?${params}` : ""}`);
}
