"use server";

import { demoLoginEnabled, signIn } from "@/lib/auth";
import { DEMO_PERSONAS } from "@/lib/demo-personas";

/** Switch to another demo account (local development only). */
export async function switchPersona(formData: FormData) {
  if (!demoLoginEnabled) throw new Error("Demo accounts are disabled");
  const persona = DEMO_PERSONAS.find((p) => p.key === formData.get("persona"));
  if (!persona) throw new Error("Unknown demo account");
  await signIn("demo", { userId: persona.userId, redirectTo: "/profile" });
}
