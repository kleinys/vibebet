import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface MyPlayerCode {
  referral_code: string;
  username: string | null;
  display_name: string | null;
}

export async function getMyPlayerCode(): Promise<MyPlayerCode | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.rpc("get_my_player_code");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.referral_code) return null;

  return {
    referral_code: String(row.referral_code),
    username: row.username ? String(row.username) : null,
    display_name: row.display_name ? String(row.display_name) : null,
  };
}
