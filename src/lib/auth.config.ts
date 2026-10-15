import type { NextAuthConfig } from "next-auth";
import { type FeatureKey, type TierId, tierFromLegacyRole } from "@/lib/access/catalog";

/**
 * Settings shared by the full auth (lib/auth.ts) and the proxy. This file must
 * not touch the database: the proxy runs before every page, and loading data
 * there made each click wait for the whole repository. The proxy only checks
 * that a session exists; feature checks happen in server code (layouts / API),
 * which reads the user's current tier and the live matrix.
 */
export const authConfig = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60, updateAge: 15 * 60 },
  providers: [],
  callbacks: {
    session({ session, token }) {
      const t = token as typeof token & { uid?: string; tier?: TierId; role?: string; features?: FeatureKey[] };
      session.user.id = t.uid ?? "";
      // Tokens issued before the tier system only carry the old role.
      session.user.tier = t.tier ?? tierFromLegacyRole(t.role);
      session.user.features = t.features ?? [];
      return session;
    },
    authorized({ auth: session, request }) {
      if (request.nextUrl.pathname.startsWith("/login")) return true;
      return !!session?.user?.id; // false → redirect to pages.signIn
    },
  },
} satisfies NextAuthConfig;
