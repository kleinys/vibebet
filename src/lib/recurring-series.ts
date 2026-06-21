"use server";

import { createClient } from "@/lib/supabase/server";

export interface RecurringSeries {
  id: string;
  creator_id: string;
  title: string;
  fast_asset: string;
  interval_sec: number;
  creator_fee_bps: number;
  enabled: boolean;
  windows_spawned: number;
  created_at: string;
}

export async function listMyRecurringSeries(
  userId: string,
): Promise<RecurringSeries[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring_market_series")
    .select("*")
    .eq("creator_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as RecurringSeries[];
}

export async function listPublicRecurringSeries(limit = 20): Promise<RecurringSeries[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring_market_series")
    .select("*")
    .eq("enabled", true)
    .order("windows_spawned", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as RecurringSeries[];
}
