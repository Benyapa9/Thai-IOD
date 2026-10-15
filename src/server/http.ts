import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/lib/auth";
import { FEATURE_BY_KEY, type FeatureKey, type TierId } from "@/lib/access/catalog";
import { featuresOf, userTier } from "@/server/access";
import { getRepo } from "@/server/repository";
import type { User } from "@/types/domain";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface Account extends User {
  tier: TierId;
  features: Set<FeatureKey>;
  can: (key: FeatureKey) => boolean;
}

/**
 * Every API route starts here (access-matrix phase 2): checks the session
 * itself, re-reads the user from the database (deactivated users are refused
 * even with a valid token) and checks the feature against the live matrix.
 * Without a key it only requires a signed-in, active user.
 */
export async function requireFeature(key?: FeatureKey | FeatureKey[]): Promise<Account> {
  const session = await auth();
  if (!session?.user?.id) throw new HttpError(401, "กรุณาเข้าสู่ระบบก่อนใช้งาน");
  const user = await (await getRepo()).users.findById(session.user.id);
  if (!user || !user.isActive) throw new HttpError(401, "บัญชีนี้ถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
  const features = await featuresOf(user);
  const needed = key === undefined ? [] : Array.isArray(key) ? key : [key];
  const missing = needed.filter((k) => !features.has(k));
  if (missing.length) {
    const names = missing.map((k) => FEATURE_BY_KEY[k]?.name ?? k).join(", ");
    throw new HttpError(403, `ระดับสิทธิ์ของคุณยังใช้ “${names}” ไม่ได้ ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์`);
  }
  return { ...user, tier: userTier(user), features, can: (k) => features.has(k) };
}

/** Departments a user may see; null = every department (MOM A5). */
export function allowedDepartments(user: Pick<User, "departments">) {
  return user.departments && user.departments.length ? user.departments : null;
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler with uniform JSON error responses. */
export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: "ข้อมูลไม่ถูกต้อง", issues: err.issues },
          { status: 400 },
        );
      }
      console.error("[api]", err);
      return NextResponse.json({ error: "เกิดข้อผิดพลาดในระบบ" }, { status: 500 });
    }
  };
}

/** Strips the Entra object ID before sending a user to the browser. */
export function toPublicUser(user: User): Omit<User, "entraId"> {
  const copy: Partial<User> = { ...user };
  delete copy.entraId;
  return copy as Omit<User, "entraId">;
}

export function searchParams(req: Request) {
  const params = new URL(req.url).searchParams;
  return (key: string) => params.get(key) || undefined;
}
