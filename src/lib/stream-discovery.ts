import "server-only";

/**
 * Discover top live streams from Twitch & YouTube (read-only, like Polymarket gamma fetch).
 *
 * Setup (same pattern as Polymarket mirrors):
 * 1. Add API keys to `.env.local` / Vercel env (see .env.local.example).
 * 2. Call `fetchDiscoveredStreams()` from `/live` or a cron route.
 * 3. Optional: persist to Supabase via `refresh_external_stream_mirrors` RPC (future migration).
 *
 * Twitch: https://dev.twitch.tv/docs/api/reference#get-streams
 * YouTube: https://developers.google.com/youtube/v3/live/docs/liveStreams/list
 */

export interface DiscoveredStream {
  id: string;
  provider: "twitch" | "youtube";
  title: string;
  channel: string;
  viewerCount: number;
  thumbnailUrl: string | null;
  watchUrl: string;
  gameOrCategory: string | null;
}

const TWITCH_TOKEN_TTL_MS = 50 * 60 * 1000;
let twitchTokenCache: { token: string; expiresAt: number } | null = null;

async function getTwitchAppToken(): Promise<string | null> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (twitchTokenCache && Date.now() < twitchTokenCache.expiresAt) {
    return twitchTokenCache.token;
  }

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
    next: { revalidate: 3000 },
  });

  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;

  twitchTokenCache = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 - TWITCH_TOKEN_TTL_MS,
  };
  return json.access_token;
}

export async function fetchTopTwitchStreams(limit = 10): Promise<DiscoveredStream[]> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const token = await getTwitchAppToken();
  if (!clientId || !token) return [];

  const params = new URLSearchParams({
    first: String(Math.min(limit, 100)),
    language: "en",
  });

  const res = await fetch(`https://api.twitch.tv/helix/streams?${params}`, {
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
    },
    next: { revalidate: 120 },
  });

  if (!res.ok) return [];

  const json = (await res.json()) as {
    data?: Array<{
      id: string;
      user_name: string;
      title: string;
      viewer_count: number;
      game_name: string;
      thumbnail_url: string;
    }>;
  };

  return (json.data ?? []).slice(0, limit).map((s) => ({
    id: `twitch-${s.id}`,
    provider: "twitch" as const,
    title: s.title,
    channel: s.user_name,
    viewerCount: s.viewer_count,
    thumbnailUrl: s.thumbnail_url?.replace("{width}", "440").replace("{height}", "248") ?? null,
    watchUrl: `https://www.twitch.tv/${encodeURIComponent(s.user_name)}`,
    gameOrCategory: s.game_name || null,
  }));
}

export async function fetchTopYouTubeLiveStreams(limit = 10): Promise<DiscoveredStream[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];

  const params = new URLSearchParams({
    part: "snippet,liveStreamingDetails",
    type: "video",
    eventType: "live",
    order: "viewCount",
    maxResults: String(Math.min(limit, 50)),
    key: apiKey,
  });

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params}`,
    { next: { revalidate: 120 } },
  );

  if (!res.ok) return [];

  const json = (await res.json()) as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        thumbnails?: { medium?: { url?: string }; high?: { url?: string } };
        liveBroadcastContent?: string;
      };
    }>;
  };

  return (json.items ?? [])
    .filter((item) => item.id?.videoId && item.snippet?.liveBroadcastContent === "live")
    .slice(0, limit)
    .map((item) => {
      const videoId = item.id!.videoId!;
      return {
        id: `youtube-${videoId}`,
        provider: "youtube" as const,
        title: item.snippet?.title ?? "Live stream",
        channel: item.snippet?.channelTitle ?? "YouTube",
        viewerCount: 0,
        thumbnailUrl:
          item.snippet?.thumbnails?.high?.url ??
          item.snippet?.thumbnails?.medium?.url ??
          null,
        watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
        gameOrCategory: null,
      };
    });
}

/** Merge Twitch + YouTube, sorted by viewer count (YouTube search lacks live CCU without extra call). */
export async function fetchDiscoveredStreams(opts?: {
  twitchLimit?: number;
  youtubeLimit?: number;
}): Promise<DiscoveredStream[]> {
  const [twitch, youtube] = await Promise.all([
    fetchTopTwitchStreams(opts?.twitchLimit ?? 10),
    fetchTopYouTubeLiveStreams(opts?.youtubeLimit ?? 10),
  ]);

  return [...twitch, ...youtube].sort((a, b) => b.viewerCount - a.viewerCount);
}

export function streamDiscoveryConfigured(): boolean {
  return Boolean(
    process.env.TWITCH_CLIENT_ID &&
      process.env.TWITCH_CLIENT_SECRET &&
      process.env.YOUTUBE_API_KEY,
  );
}
