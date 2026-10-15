import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, demoLoginEnabled, entraConfigured, signIn } from "@/lib/auth";
import { DEFAULT_PERSONA } from "@/lib/demo-personas";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

const ERRORS: Record<string, string> = {
  AccessDenied: "บัญชีนี้ไม่มีสิทธิ์เข้าใช้งาน หรือถูกปิดการใช้งาน",
  CredentialsSignin: "ไม่สามารถเข้าสู่ระบบด้วยบัญชีสาธิตนี้ได้",
  Configuration: "การตั้งค่าระบบยืนยันตัวตนไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ",
};

/**
 * After signing in everyone starts on Home. Only deep links to one item
 * (e.g. /follow-up?id=… from a notification email) are kept. Path only, so a
 * crafted callbackUrl can't redirect off-site.
 */
function safeCallback(url: unknown) {
  if (typeof url !== "string") return "/home";
  try {
    const { pathname, searchParams } = new URL(url, "http://local");
    const id = searchParams.get("id");
    return pathname.startsWith("/follow-up") && id ? `/follow-up?id=${encodeURIComponent(id)}` : "/home";
  } catch {
    return "/home";
  }
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const callbackUrl = safeCallback(params.callbackUrl);
  const error = typeof params.error === "string" ? params.error : undefined;

  if ((await auth())?.user?.id) redirect(callbackUrl);

  const supportEmail = process.env.SUPPORT_EMAIL?.trim() || null;
  async function signInMicrosoft() {
    "use server";
    await signIn("microsoft-entra-id", { redirectTo: callbackUrl });
  }

  async function signInDemo() {
    "use server";
    try {
      await signIn("demo", { userId: DEFAULT_PERSONA.userId, redirectTo: callbackUrl });
    } catch (err) {
      if (err instanceof AuthError) redirect(`/login?error=${err.type}`);
      throw err;
    }
  }

  return (
    <div className="relative flex min-h-screen">
      <div className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-navy-900 p-12 text-white lg:flex">
        {/* Looping brand video as the background; navy shows until it loads (and if it can't play). */}
        <video
          className="pointer-events-none absolute inset-0 size-full object-cover"
          src="/brand/login-bg.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
        />
        {/* Soft gradient so the text stays readable over any frame. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy-950/70 via-navy-950/20 to-transparent" aria-hidden="true" />
        <div className="relative z-10 flex h-full flex-col justify-between">
          <div className="inline-flex w-fit rounded-xl bg-white px-4 py-3 shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
            <img src="/brand/iod-finance-intelligence-lockup.png" alt="Thai Institute of Directors — IOD Finance Intelligence" className="h-[45px] w-auto sm:h-14" />
          </div>
          <div className="max-w-md rounded-2xl border border-white/15 bg-navy-950/55 p-6 shadow-2xl backdrop-blur-md">
            <span className="mb-3 block h-1 w-12 rounded-full bg-accent" aria-hidden="true" />
            <h1 className="text-3xl font-semibold leading-snug">IOD Finance Intelligence</h1>
            <p className="mt-1 text-sm tracking-wide text-white/80">Insight. Accuracy. Confidence.</p>
            <p className="mt-4 text-white/90">
              เห็นสัญญาณสำคัญทางการเงินทันที ติดตาม KPI ทดลอง Scenario และติดตามการแก้ไขของทีมในที่เดียว
            </p>
          </div>
          <p className="w-fit rounded-full bg-navy-950/50 px-3 py-1 text-xs text-white/85 backdrop-blur-sm">Developed by ZyGen BAAI Team</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-white p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
            <img src="/brand/iod-finance-intelligence-lockup.png" alt="Thai Institute of Directors — IOD Finance Intelligence" className="h-auto w-full max-w-56" />
          </div>
          <h2 className="text-xl font-semibold text-navy-900">เข้าสู่ระบบ</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {entraConfigured ? "ใช้บัญชี Microsoft 365 ขององค์กร" : "กดปุ่มด้านล่างเพื่อเข้าใช้งาน"}
          </p>

          {error && (
            <div className="mt-4 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
              {ERRORS[error] ?? "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่"}
            </div>
          )}

          {/* One button: Microsoft when configured, otherwise the local demo account. */}
          <form action={entraConfigured ? signInMicrosoft : signInDemo} className="mt-6">
            <button
              type="submit"
              disabled={!entraConfigured && !demoLoginEnabled}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-navy-950 via-navy-800 to-navy-600 text-base font-semibold text-white shadow-md transition-shadow hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {entraConfigured && (
                <svg viewBox="0 0 21 21" className="size-4" aria-hidden="true">
                  <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                </svg>
              )}
              {entraConfigured ? "เข้าสู่ระบบด้วย Microsoft" : "เข้าสู่ระบบ"}
            </button>
          </form>
          {!entraConfigured && demoLoginEnabled && (
            <p className="mt-2 text-xs text-muted-foreground">
              โหมดทดลอง (Local Dev) — เข้าเป็นบัญชี {DEFAULT_PERSONA.label} เปลี่ยนเป็น Standard / Advanced / IT ได้ที่หน้าโปรไฟล์
            </p>
          )}
          {!entraConfigured && !demoLoginEnabled && (
            <p className="mt-2 text-xs text-muted-foreground">ยังไม่ได้ตั้งค่า AZURE_AD_CLIENT_ID / SECRET / TENANT_ID</p>
          )}
        </div>
      </div>

      {/* MOM G6: small help link at the bottom right */}
      <p className="absolute right-4 bottom-3 left-4 text-right text-xs text-muted-foreground">
        ไม่สามารถเข้าสู่ระบบได้?{" "}
        {supportEmail ? (
          <a
            href={`mailto:${supportEmail}?subject=${encodeURIComponent("แจ้งปัญหาเข้าสู่ระบบ IOD Finance Intelligence")}`}
            className="font-medium text-navy-700 underline"
          >
            ติดต่อผู้ดูแลระบบ
          </a>
        ) : (
          <span className="font-medium text-navy-700">ติดต่อผู้ดูแลระบบ (ฝ่าย IT) ของ Thai IOD</span>
        )}
      </p>
    </div>
  );
}
