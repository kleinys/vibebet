"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { applyReferralCode } from "@/lib/referrals";

export async function applyReferralFromForm(
  _prev: { error?: string; ok?: string } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: string }> {
  const parsed = z
    .object({ code: z.string().trim().min(4).max(12) })
    .safeParse({ code: formData.get("code") });
  if (!parsed.success) return { error: "Invalid code." };

  const result = await applyReferralCode(parsed.data.code);
  if (!result.ok) return { error: result.error ?? "Could not apply code." };

  revalidatePath("/invite");
  return { ok: "Referral applied — your friend earned 100 VIBE!" };
}
