import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PlayerPath } from "@/lib/player-path";

export async function getPlayerPath(userId: string): Promise<PlayerPath> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("player_path")
    .eq("id", userId)
    .maybeSingle();

  const path = data?.player_path;
  if (
    path === "predict" ||
    path === "compete" ||
    path === "watch" ||
    path === "explore"
  ) {
    return path;
  }
  return "explore";
}
