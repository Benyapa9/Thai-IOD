import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppFrame } from "@/components/layout/app-frame";
import { UserProvider } from "@/components/layout/user-context";
import { auth, signOut } from "@/lib/auth";
import { featuresOf, userTier } from "@/server/access";
import { getRepo, isDemoData } from "@/server/repository";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const dbUser = await (await getRepo()).users.findById(session.user.id);
  if (!dbUser || !dbUser.isActive) redirect("/login");

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  const cookieLocale = (await cookies()).get("locale")?.value;
  const locale = cookieLocale === "en" || cookieLocale === "th" ? cookieLocale : dbUser.locale;

  return (
    <UserProvider
      theme={dbUser.theme}
      locale={locale}
      user={{
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        tier: userTier(dbUser),
        // Fresh from the live matrix on every page load (not the cached token).
        features: [...(await featuresOf(dbUser))],
        image: dbUser.consent?.photo ? dbUser.image : null,
        jobTitle: dbUser.consent?.jobTitle ? dbUser.jobTitle : null,
        departments: dbUser.departments && dbUser.departments.length ? dbUser.departments : null,
        consentDecided: !!dbUser.consent,
        tourSeen: dbUser.tourSeen ?? {},
      }}
    >
      {/* No <Suspense> around the shell: this layout is dynamic (cookies), so useSearchParams needs none, and a
          boundary here made the whole menu wait for a streamed reveal before it could hydrate (clicks then did full reloads). */}
      <AppFrame demo={isDemoData} signOutAction={signOutAction}>
        {children}
      </AppFrame>
    </UserProvider>
  );
}
