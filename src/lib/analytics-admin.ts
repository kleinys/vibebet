import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface AnalyticsSummaryRow {
  event_name: string;
  event_count: number;
  unique_users: number;
}

export interface AnalyticsEventRow {
  id: string;
  user_id: string | null;
  event_name: string;
  properties: Record<string, unknown>;
  created_at: string;
}

export async function getAnalyticsSummary(
  days = 7,
): Promise<AnalyticsSummaryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_analytics_summary", {
    p_days: days,
  });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    event_name: String(row.event_name),
    event_count: Number(row.event_count),
    unique_users: Number(row.unique_users),
  }));
}

export async function getRecentAnalyticsEvents(
  limit = 50,
  eventName?: string,
): Promise<AnalyticsEventRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_recent_analytics_events", {
    p_limit: limit,
    p_event_name: eventName ?? undefined,
  });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    user_id: row.user_id ? String(row.user_id) : null,
    event_name: String(row.event_name),
    properties: (row.properties as Record<string, unknown>) ?? {},
    created_at: String(row.created_at),
  }));
}

export async function exportAnalyticsEvents(
  sinceDays = 7,
  limit = 5000,
): Promise<AnalyticsEventRow[]> {
  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - sinceDays);
  const { data, error } = await supabase.rpc("export_analytics_events", {
    p_since: since.toISOString(),
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    user_id: row.user_id ? String(row.user_id) : null,
    event_name: String(row.event_name),
    properties: (row.properties as Record<string, unknown>) ?? {},
    created_at: String(row.created_at),
  }));
}

export function analyticsEventsToCsv(rows: AnalyticsEventRow[]): string {
  const header = "id,user_id,event_name,created_at,properties";
  const lines = rows.map((r) => {
    const props = JSON.stringify(r.properties).replace(/"/g, '""');
    return [
      r.id,
      r.user_id ?? "",
      r.event_name,
      r.created_at,
      `"${props}"`,
    ].join(",");
  });
  return [header, ...lines].join("\n");
}
