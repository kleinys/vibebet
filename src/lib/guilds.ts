import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface GuildSummary {
  rank: number;
  guild_id: string;
  name: string;
  slug: string;
  tag: string;
  member_count: number;
  weekly_volume: number;
  total_volume: number;
}

export interface MyGuild {
  id: string;
  name: string;
  slug: string;
  tag: string;
  description: string | null;
  member_count: number;
  weekly_volume: number;
  total_volume: number;
  role: string;
  owner_id: string;
}

export interface GuildDetail extends Omit<MyGuild, "role"> {
  created_at: string;
}

export interface GuildMember {
  user_id: string;
  display_name: string;
  role: string;
  joined_at: string;
}

function parseGuild(raw: Record<string, unknown> | null): MyGuild | null {
  if (!raw?.id) return null;
  return {
    id: String(raw.id),
    name: String(raw.name),
    slug: String(raw.slug),
    tag: String(raw.tag),
    description: (raw.description as string) ?? null,
    member_count: Number(raw.member_count ?? 0),
    weekly_volume: Number(raw.weekly_volume ?? 0),
    total_volume: Number(raw.total_volume ?? 0),
    role: String(raw.role ?? "member"),
    owner_id: String(raw.owner_id),
  };
}

export async function getMyGuild(): Promise<MyGuild | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_guild");
  if (error) return null;
  return parseGuild(data as Record<string, unknown> | null);
}

export async function getGuildBySlug(slug: string): Promise<GuildDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_guild_by_slug", {
    p_slug: slug,
  });
  if (error) throw error;
  const raw = data as Record<string, unknown> | null;
  if (!raw?.id) return null;
  return {
    id: String(raw.id),
    name: String(raw.name),
    slug: String(raw.slug),
    tag: String(raw.tag),
    description: (raw.description as string) ?? null,
    member_count: Number(raw.member_count ?? 0),
    weekly_volume: Number(raw.weekly_volume ?? 0),
    total_volume: Number(raw.total_volume ?? 0),
    owner_id: String(raw.owner_id),
    created_at: String(raw.created_at),
  };
}

export async function getGuildLeaderboard(
  limit = 25,
): Promise<GuildSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("guild_leaderboard", {
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as GuildSummary[];
}

export async function getGuildMembers(
  guildId: string,
  limit = 50,
): Promise<GuildMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_guild_members", {
    p_guild_id: guildId,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as GuildMember[];
}
