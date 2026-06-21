"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function toggleEmailDigest(enabled: boolean): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("set_email_digest_enabled", { p_enabled: enabled });
  revalidatePath("/account/digest");
}
