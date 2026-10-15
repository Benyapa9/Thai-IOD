import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

/** Database-free NextAuth instance for the proxy (see lib/auth.config.ts). */
export const { auth } = NextAuth(authConfig);
