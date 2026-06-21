"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import { trackEvent } from "@/lib/analytics";
import { applyReferralCode } from "@/lib/referrals";
import { isEnabled } from "@/lib/feature-flags";

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  displayName: z.string().trim().min(2).max(40),
  referralCode: z.string().trim().max(12).optional(),
});

export type ActionState = { error?: string } | null;

export async function signup(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = SignupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
    referralCode: formData.get("referralCode") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const env = serverEnv();

  const { data: signUpData, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      data: { display_name: parsed.data.displayName },
    },
  });
  if (error) {
    return { error: error.message };
  }

  if (parsed.data.referralCode && signUpData.user) {
    const referralsOn = await isEnabled("referrals_enabled");
    if (referralsOn) {
      await applyReferralCode(parsed.data.referralCode);
    }
  }

  await trackEvent("signup_complete");

  revalidatePath("/", "layout");
  redirect("/onboarding");
}
