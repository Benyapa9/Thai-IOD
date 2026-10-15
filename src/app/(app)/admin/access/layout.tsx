import { guardRoute } from "@/server/page-guard";

export default async function GuardedLayout({ children }: { children: React.ReactNode }) {
  await guardRoute("/admin/access");
  return children;
}
