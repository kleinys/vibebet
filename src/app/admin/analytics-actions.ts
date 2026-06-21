"use server";

import {
  analyticsEventsToCsv,
  exportAnalyticsEvents,
  getAnalyticsSummary,
  getRecentAnalyticsEvents,
} from "@/lib/analytics-admin";

export async function downloadAnalyticsCsv(sinceDays: number) {
  const rows = await exportAnalyticsEvents(sinceDays, 5000);
  return analyticsEventsToCsv(rows);
}

export async function fetchAnalyticsSummary(days: number) {
  return getAnalyticsSummary(days);
}

export async function fetchRecentAnalyticsEvents(limit: number) {
  return getRecentAnalyticsEvents(limit);
}
