import { createClient } from "@/lib/supabase/server";

export type ShareProfile = {
  displayName: string;
  username: string | null;
};

export async function getShareProfile(userId: string): Promise<ShareProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", userId)
    .maybeSingle();

  if (!data) return null;
  return {
    displayName: data.display_name ?? "Player",
    username: data.username,
  };
}
