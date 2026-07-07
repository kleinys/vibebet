import "server-only";

export type StreamProvider = "youtube" | "twitch";

export interface DiscoveredStream {
  id: string;
  provider: StreamProvider;
  title: string;
  channel: string;
  viewerCount: number;
  thumbnailUrl: string | null;
  watchUrl: string;
  gameOrCategory: string | null;
}

export interface StreamDiscoveryResult {
  streams: DiscoveredStream[];
  youtubeConfigured: boolean;
  twitchConfigured: boolean;
  configured: boolean;
  error: string | null;
  youtubeError: string | null;
  twitchError: string | null;
}

function youtubeApiKey(): string | null {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  return key && key.length > 10 ? key : null;
}

function twitchCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.TWITCH_CLIENT_ID?.trim();
  const clientSecret = process.env.TWITCH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret || clientId.length < 10 || clientSecret.length < 10) return null;
  return { clientId, clientSecret };
}

export function streamDiscoveryConfigured(): boolean {
  return youtubeApiKey() != null || twitchCredentials() != null;
}

let twitchTokenCache: { token: string; expiresAt: number } | null = null;

async function twitchAppToken(clientId: string, clientSecret: string): Promise<string | null> {
  if (twitchTokenCache && Date.now() < twitchTokenCache.expiresAt - 60_000) {
    return twitchTokenCache.token;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });

  const res = await fetch(`https://id.twitch.tv/oauth2/token?${params}`, {
    method: "POST",
    cache: "no-store",
  });

  if (!res.ok) return null;

  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;

  twitchTokenCache = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return json.access_token;
}

async function fetchTwitchLiveStreams(
  clientId: string,
  clientSecret: string,
  limit: number,
): Promise<{ streams: DiscoveredStream[]; error: string | null }> {
  const token = await twitchAppToken(clientId, clientSecret);
  if (!token) {
    return { streams: [], error: "Twitch auth failed — check TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET." };
  }

  const headers = {
    "Client-Id": clientId,
    Authorization: `Bearer ${token}`,
  };

  const params = new URLSearchParams({
    first: String(Math.min(limit, 100)),
  });

  const res = await fetch(`https://api.twitch.tv/helix/streams?${params}`, {
    headers,
    cache: "no-store",
  });

  const json = (await res.json()) as {
    error?: string;
    message?: string;
    data?: Array<{
      id?: string;
      user_id?: string;
      user_login?: string;
      user_name?: string;
      game_name?: string;
      title?: string;
      viewer_count?: number;
      thumbnail_url?: string;
    }>;
  };

  if (!res.ok) {
    return {
      streams: [],
      error: `Twitch API ${res.status}: ${json.message ?? json.error ?? res.statusText}`,
    };
  }

  const streams: DiscoveredStream[] = (json.data ?? [])
    .filter((row) => row.user_login)
    .slice(0, limit)
    .map((row) => {
      const login = row.user_login!;
      const thumb = row.thumbnail_url
        ? row.thumbnail_url.replace("{width}", "440").replace("{height}", "248")
        : `https://static-cdn.jtvnw.net/previews-ttv/live_user_${login}-440x248.jpg`;

      return {
        id: `twitch-${login}`,
        provider: "twitch" as const,
        title: row.title ?? "Live on Twitch",
        channel: row.user_name ?? login,
        viewerCount: row.viewer_count ?? 0,
        thumbnailUrl: thumb,
        watchUrl: `https://www.twitch.tv/${login}`,
        gameOrCategory: row.game_name ?? null,
      };
    });

  streams.sort((a, b) => b.viewerCount - a.viewerCount);

  if (streams.length === 0) {
    return { streams: [], error: "No live Twitch streams returned right now." };
  }

  return { streams, error: null };
}

async function youtubeSearchLive(
  key: string,
  opts: { q?: string; maxResults?: number },
): Promise<{ items: Array<{ videoId: string; title: string; channel: string; thumb: string | null }>; error: string | null }> {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    eventType: "live",
    maxResults: String(opts.maxResults ?? 15),
    key,
  });
  if (opts.q) params.set("q", opts.q);
  else params.set("order", "viewCount");

  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {
    cache: "no-store",
  });

  const json = (await res.json()) as {
    error?: { message?: string; errors?: Array<{ reason?: string }> };
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        thumbnails?: { high?: { url?: string }; medium?: { url?: string } };
      };
    }>;
  };

  if (!res.ok) {
    const reason = json.error?.errors?.[0]?.reason;
    const msg = json.error?.message ?? res.statusText;
    if (reason === "ipRefererBlocked" || reason === "forbidden") {
      return {
        items: [],
        error:
          "YouTube API key blocked server requests. In Google Cloud → Credentials → edit key → Application restrictions → set to None (or IP), not HTTP referrer.",
      };
    }
    return { items: [], error: `YouTube API ${res.status}: ${msg}` };
  }

  const items = (json.items ?? [])
    .filter((item) => item.id?.videoId)
    .map((item) => ({
      videoId: item.id!.videoId!,
      title: item.snippet?.title ?? "Live stream",
      channel: item.snippet?.channelTitle ?? "YouTube",
      thumb:
        item.snippet?.thumbnails?.high?.url ??
        item.snippet?.thumbnails?.medium?.url ??
        null,
    }));

  return { items, error: null };
}

async function enrichYoutubeViewerCounts(
  key: string,
  videoIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (videoIds.length === 0) return counts;

  const chunks: string[][] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    chunks.push(videoIds.slice(i, i + 50));
  }

  for (const chunk of chunks) {
    const params = new URLSearchParams({
      part: "liveStreamingDetails,statistics",
      id: chunk.join(","),
      key,
    });
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`, {
      cache: "no-store",
    });
    if (!res.ok) continue;

    const json = (await res.json()) as {
      items?: Array<{
        id?: string;
        liveStreamingDetails?: { concurrentViewers?: string };
        statistics?: { viewCount?: string };
      }>;
    };

    for (const item of json.items ?? []) {
      if (!item.id) continue;
      const live = item.liveStreamingDetails?.concurrentViewers;
      const views = item.statistics?.viewCount;
      counts.set(item.id, live ? Number(live) : views ? Number(views) : 0);
    }
  }

  return counts;
}

async function fetchYoutubeStreams(limit: number): Promise<{ streams: DiscoveredStream[]; error: string | null }> {
  const key = youtubeApiKey();
  if (!key) return { streams: [], error: null };

  const seen = new Set<string>();
  const merged: Array<{ videoId: string; title: string; channel: string; thumb: string | null }> = [];
  let lastError: string | null = null;

  for (const search of [{ q: undefined }, { q: "gaming live" }, { q: "esports live" }] as const) {
    if (merged.length >= limit) break;
    const remaining = limit - merged.length;
    const { items, error } = await youtubeSearchLive(key, {
      q: search.q,
      maxResults: Math.min(remaining, 50),
    });
    if (error) lastError = error;
    for (const item of items) {
      if (seen.has(item.videoId)) continue;
      seen.add(item.videoId);
      merged.push(item);
      if (merged.length >= limit) break;
    }
    if (items.length > 0 && !error) lastError = null;
  }

  const viewerMap = await enrichYoutubeViewerCounts(
    key,
    merged.map((m) => m.videoId),
  );

  const streams: DiscoveredStream[] = merged.slice(0, limit).map((item) => ({
    id: `youtube-${item.videoId}`,
    provider: "youtube",
    title: item.title,
    channel: item.channel,
    viewerCount: viewerMap.get(item.videoId) ?? 0,
    thumbnailUrl: item.thumb,
    watchUrl: `https://www.youtube.com/watch?v=${item.videoId}`,
    gameOrCategory: null,
  }));

  streams.sort((a, b) => b.viewerCount - a.viewerCount);

  if (streams.length === 0 && !lastError) {
    lastError = "No live YouTube streams returned right now.";
  }

  return { streams, error: streams.length === 0 ? lastError : null };
}

export function streamWatchId(stream: DiscoveredStream): string {
  const prefix = `${stream.provider}-`;
  return stream.id.startsWith(prefix) ? stream.id.slice(prefix.length) : stream.id;
}

export function streamWatchHref(stream: DiscoveredStream): string {
  const id = streamWatchId(stream);
  const game = stream.gameOrCategory
    ? `&game=${encodeURIComponent(stream.gameOrCategory)}`
    : "";
  return `/live/watch?provider=${stream.provider}&id=${encodeURIComponent(id)}&title=${encodeURIComponent(stream.title)}&channel=${encodeURIComponent(stream.channel)}${game}`;
}

export async function fetchDiscoveredStreamsWithMeta(opts?: {
  youtubeLimit?: number;
  twitchLimit?: number;
}): Promise<StreamDiscoveryResult> {
  const youtubeLimit = opts?.youtubeLimit ?? 20;
  const twitchLimit = opts?.twitchLimit ?? 20;
  const ytKey = youtubeApiKey();
  const twitch = twitchCredentials();

  const [youtubeResult, twitchResult] = await Promise.all([
    ytKey ? fetchYoutubeStreams(youtubeLimit) : Promise.resolve({ streams: [], error: null }),
    twitch
      ? fetchTwitchLiveStreams(twitch.clientId, twitch.clientSecret, twitchLimit)
      : Promise.resolve({ streams: [], error: null }),
  ]);

  const streams = [...youtubeResult.streams, ...twitchResult.streams].sort(
    (a, b) => b.viewerCount - a.viewerCount,
  );

  const youtubeConfigured = ytKey != null;
  const twitchConfigured = twitch != null;

  let error: string | null = null;
  if (streams.length === 0) {
    error = youtubeResult.error ?? twitchResult.error ?? "No live streams found right now.";
  }

  return {
    streams,
    youtubeConfigured,
    twitchConfigured,
    configured: youtubeConfigured || twitchConfigured,
    error: streams.length === 0 ? error : null,
    youtubeError: youtubeResult.error,
    twitchError: twitchResult.error,
  };
}

/** @deprecated use fetchDiscoveredStreamsWithMeta */
export async function fetchDiscoveredStreams(opts?: {
  youtubeLimit?: number;
  twitchLimit?: number;
}): Promise<DiscoveredStream[]> {
  const result = await fetchDiscoveredStreamsWithMeta(opts);
  return result.streams;
}
