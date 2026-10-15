import { NextResponse } from "next/server";
import { userTier } from "@/server/access";
import { tierCounts, updateUsersAccess } from "@/server/access-admin";
import { requireFeature, route, toPublicUser } from "@/server/http";
import { getRepo } from "@/server/repository";
import type { User } from "@/types/domain";

/**
 * Everyone gets the active directory (for Follow-up owners). With users.manage
 * you also get inactive users, each user's tier, department access and the
 * number of users per tier — never other people's photos or consent.
 */
export const GET = route(async () => {
  const user = await requireFeature();
  const users = await (await getRepo()).users.list();
  const admin = user.can("users.manage");
  const visible = admin ? users : users.filter((u) => u.isActive);
  const shape = (u: User) => {
    const pub = toPublicUser(u);
    const tierId = userTier(u);
    return admin
      ? { ...pub, tierId, image: null, consent: null, tourSeen: null }
      : { id: pub.id, name: pub.name, email: pub.email, role: pub.role, tierId, department: pub.department, isActive: pub.isActive };
  };
  return NextResponse.json({ users: visible.map(shape), ...(admin ? { counts: tierCounts(users) } : {}) });
});

/**
 * Change tier / active status of one or more users (diff), in one transaction,
 * audited. 403 for your own row, 409 if no active IT user would remain.
 */
export const PATCH = route(async (req) => {
  const actor = await requireFeature("users.manage");
  const result = await updateUsersAccess(actor, await req.json());
  return NextResponse.json({ changed: result.changed, counts: tierCounts(result.users) });
});
