import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { authConfig } from "@/lib/auth.config";
import type { FeatureKey, TierId } from "@/lib/access/catalog";
import { effectiveByTier, userTier } from "@/server/access";
import { getRepo } from "@/server/repository";

declare module "next-auth" {
  interface Session {
    user: { id: string; tier: TierId; features: FeatureKey[] } & DefaultSession["user"];
  }
}

export interface AppToken {
  uid?: string;
  tier?: TierId;
  /** Effective features at the last check (informational — the server re-checks on every API call). */
  features?: FeatureKey[];
  /** Matrix version and the user's own permission version the features were computed for. */
  accessVersion?: number;
  permVersion?: number;
  checkedAt?: number;
  msAccessToken?: string;
  msTokenExpires?: number;
}

export const entraConfigured = !!(
  process.env.AZURE_AD_CLIENT_ID &&
  process.env.AZURE_AD_CLIENT_SECRET &&
  process.env.AZURE_AD_TENANT_ID
);

/** Local-only role picker. Never enable in production. */
export const demoLoginEnabled =
  process.env.AUTH_DEMO_LOGIN === "true" && process.env.NODE_ENV !== "production";

/** Sessions pick up tier / matrix / deactivation changes within this time. */
const PERMISSION_REFRESH_MS = 60 * 1000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...(entraConfigured
      ? [
          MicrosoftEntraID({
            clientId: process.env.AZURE_AD_CLIENT_ID,
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
            issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
            // Skip the Graph photo fetch — a base64 image would bloat the JWT cookie.
            profile: (p) => ({
              id: p.oid ?? p.sub,
              name: p.name,
              email: p.email ?? p.preferred_username,
              image: null,
            }),
          }),
        ]
      : []),
    ...(demoLoginEnabled
      ? [
          Credentials({
            id: "demo",
            name: "Demo",
            credentials: { userId: { label: "User" } },
            async authorize(credentials) {
              const repo = await getRepo();
              const user = await repo.users.findById(String(credentials?.userId ?? ""));
              if (!user?.isActive) return null;
              return { id: user.id, name: user.name, email: user.email };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, account, profile, user }) {
      const t = token as typeof token & AppToken;
      const due = (x: AppToken) => !!x.uid && (!x.tier || !x.checkedAt || Date.now() - x.checkedAt > PERMISSION_REFRESH_MS);
      const needsRefresh = due(t);
      // Only touch the repository when there is something to do.
      if (!account && !needsRefresh) return t;
      const repo = await getRepo();

      if (account?.provider === "microsoft-entra-id" && profile) {
        const dbUser = await repo.users.upsertFromEntra({
          entraId: String(profile.oid ?? profile.sub),
          email: String(profile.email ?? profile.preferred_username ?? ""),
          name: String(profile.name ?? ""),
        });
        t.uid = dbUser.id;
        // Kept (encrypted in the session cookie) so a later consent change can sync from Graph.
        t.msAccessToken = account.access_token;
        t.msTokenExpires = account.expires_at ? account.expires_at * 1000 : undefined;
        // MOM A7/A8: sync job title / photo only when the user allowed it.
        if (dbUser.consent && account.access_token) {
          const { syncFromMicrosoft } = await import("@/server/graph");
          await syncFromMicrosoft(dbUser.id, account.access_token, dbUser.consent).catch((err) =>
            console.warn("[auth] profile sync skipped:", (err as Error).message),
          );
        }
      } else if (account?.provider === "demo" && user?.id) {
        t.uid = user.id;
      }

      // Pick up tier / matrix / deactivation changes made by an admin mid-session:
      // recompute only when the matrix version or the user's permVersion moved.
      if (due(t)) {
        const dbUser = await repo.users.findById(t.uid!);
        if (!dbUser?.isActive) return null;
        const { version, byTier } = await effectiveByTier();
        const tier = userTier(dbUser);
        if (t.tier !== tier || t.accessVersion !== version || t.permVersion !== dbUser.permVersion || !t.features) {
          t.tier = tier;
          t.features = [...byTier[tier]];
          t.accessVersion = version;
          t.permVersion = dbUser.permVersion;
        }
        t.name = dbUser.name;
        t.checkedAt = Date.now();
      }
      return t;
    },
  },
  events: {
    async signIn({ account, profile }) {
      if (account?.provider === "microsoft-entra-id") {
        console.info("[auth] sign-in", profile?.email ?? profile?.preferred_username);
      }
    },
  },
});
