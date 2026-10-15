/**
 * Runs before every page: only checks that the user is signed in (no database
 * access, so it is instant). Level checks live in the page layouts and API routes.
 */
export { auth as proxy } from "@/lib/auth.proxy";

export const config = {
  // Pages only — API routes check the session themselves and answer 401 JSON.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|samples/|brand/).*)"],
};
