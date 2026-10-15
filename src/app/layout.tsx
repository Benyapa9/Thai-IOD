import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { cookies } from "next/headers";
import { Providers } from "@/components/providers";
import "./globals.css";

const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "IOD Finance Intelligence", template: "%s · IOD Finance Intelligence" },
  description: "IOD Finance Intelligence — Insight. Accuracy. Confidence. (Thai Institute of Directors × ZyGen)",
  icons: { icon: "/brand/thai-iod-logo.png" },
};

/** Apply the saved colour theme, custom colour and day/night mode before first paint to avoid a flash (MOM G4). */
const themeScript = `try{var d=document.documentElement,s=localStorage,t=s.getItem("iod-theme"),c=s.getItem("iod-theme-color"),m=s.getItem("iod-mode");if(t)d.dataset.theme=t;if(c&&/^#[0-9a-f]{6}$/i.test(c))d.style.setProperty("--theme-base",c);if(m==="dark")d.dataset.mode="dark"}catch(e){}`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = (await cookies()).get("locale")?.value === "en" ? "en" : "th";
  return (
    // suppressHydrationWarning: browser extensions (e.g. Scribe, Grammarly) and the
    // theme script add attributes on <html>/<body> before React hydrates.
    <html lang={locale} className={`${plexThai.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
