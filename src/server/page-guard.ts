import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { featureForPath } from "@/lib/rbac";
import { featuresOf } from "@/server/access";
import { getRepo } from "@/server/repository";

/**
 * Page-level access check used by the section layouts. Runs on the server
 * with the user's current tier and the live matrix — the proxy only checks
 * that someone is signed in.
 */
export async function guardRoute(pathPrefix: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const feature = featureForPath(pathPrefix);
  if (!feature) return;
  const user = await (await getRepo()).users.findById(session.user.id);
  if (!user?.isActive) redirect("/login");
  if (!(await featuresOf(user)).has(feature)) redirect("/home?denied=1");
}
