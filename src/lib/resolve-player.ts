import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface ResolvedPlayer {
  user_id: string;
  display_name: string;
  username: string | null;
  referral_code: string;
}

export async function resolvePlayerCode(
  code: string,
): Promise<ResolvedPlayer | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_player_code", {
    p_code: trimmed,
  });
  if (error) return null;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.user_id || !row?.referral_code) return null;

  return {
    user_id: String(row.user_id),
    display_name: String(row.display_name ?? "Player"),
    username: row.username ? String(row.username) : null,
    referral_code: String(row.referral_code),
  };
}
