"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { trackEvent } from "@/lib/analytics";
import { hubForPath, type PlayerPath } from "@/lib/player-path";

const VALID: PlayerPath[] = ["predict", "compete", "watch", "explore"];

export async function setPlayerPath(
  path: PlayerPath,
  options?: { redirect?: boolean },
): Promise<{ error?: string }> {
  if (!VALID.includes(path)) return { error: "Invalid mode." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };

  const { error } = await supabase.rpc("set_player_path", { p_path: path });
  if (error) return { error: error.message };

  await trackEvent("player_path_set", { path });
  revalidatePath("/", "layout");

  if (options?.redirect !== false) {
    redirect(hubForPath(path));
  }
  return {};
}

export async function saveOnboardingPath(
  path: PlayerPath,
): Promise<{ error?: string }> {
  if (!VALID.includes(path)) return { error: "Invalid mode." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_onboarding_path", { p_path: path });
  if (error) return { error: error.message };

  await trackEvent("onboarding_path_saved", { path });
  revalidatePath("/onboarding");
  return {};
}
