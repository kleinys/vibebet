import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface ActiveTournament {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  prize_pool: number;
  sponsor_name: string | null;
  prize_splits: number[];
  prizes_distributed: boolean;
}

export interface TournamentRow {
  rank: number;
  user_id: string;
  display_name: string;
  volume: number;
}

export interface LastTournamentResults {
  title: string;
  ends_at: string;
  sponsor_name: string | null;
  total_paid: number;
  payouts: { rank: number; display_name: string; amount: number }[];
}

export async function getActiveTournament(): Promise<ActiveTournament | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_active_tournament");
  if (error) return null;
  const raw = data as Record<string, unknown> | null;
  if (!raw?.id) return null;
  const splits = raw.prize_splits;
  return {
    id: String(raw.id),
    slug: String(raw.slug),
    title: String(raw.title),
    description: (raw.description as string) ?? null,
    starts_at: String(raw.starts_at),
    ends_at: String(raw.ends_at),
    prize_pool: Number(raw.prize_pool ?? 0),
    sponsor_name: (raw.sponsor_name as string) ?? null,
    prize_splits: Array.isArray(splits)
      ? splits.map((x) => Number(x))
      : [50, 30, 20],
    prizes_distributed: Boolean(raw.prizes_distributed),
  };
}

export async function getTournamentLeaderboard(
  limit = 25,
): Promise<TournamentRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_tournament_leaderboard", {
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as TournamentRow[];
}

export async function getLastTournamentResults(): Promise<LastTournamentResults | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_last_tournament_results");
  if (error) return null;
  const raw = data as Record<string, unknown> | null;
  if (!raw?.title) return null;
  const payouts = Array.isArray(raw.payouts) ? raw.payouts : [];
  return {
    title: String(raw.title),
    ends_at: String(raw.ends_at),
    sponsor_name: (raw.sponsor_name as string) ?? null,
    total_paid: Number(raw.total_paid ?? 0),
    payouts: payouts.map((p) => {
      const row = p as Record<string, unknown>;
      return {
        rank: Number(row.rank),
        display_name: String(row.display_name ?? "Anonymous"),
        amount: Number(row.amount ?? 0),
      };
    }),
  };
}
