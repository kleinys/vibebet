import "server-only";

export interface DiscoveredStream {
  id: string;
  provider: "youtube";
  title: string;
  channel: string;
  viewerCount: number;
  thumbnailUrl: string | null;
  watchUrl: string;
  gameOrCategory: string | null;
}

export interface StreamDiscoveryResult {
  streams: DiscoveredStream[];
  configured: boolean;
  error: string | null;
}

function apiKey(): string | null {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  return key && key.length > 10 ? key : null;
}

export function streamDiscoveryConfigured(): boolean {
  return apiKey() != null;
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
        liveBroadcastContent?: string;
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

async function enrichViewerCounts(
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
      counts.set(
        item.id,
        live ? Number(live) : views ? Number(views) : 0,
      );
    }
  }

  return counts;
}

export async function fetchDiscoveredStreamsWithMeta(opts?: {
  youtubeLimit?: number;
}): Promise<StreamDiscoveryResult> {
  const key = apiKey();
  if (!key) {
    return { streams: [], configured: false, error: null };
  }

  const limit = opts?.youtubeLimit ?? 20;
  const seen = new Set<string>();
  const merged: Array<{ videoId: string; title: string; channel: string; thumb: string | null }> = [];
  let lastError: string | null = null;

  const searches = [
    { q: undefined },
    { q: "gaming live" },
    { q: "esports live" },
  ] as const;

  for (const search of searches) {
    if (merged.length >= limit) break;
    const { items, error } = await youtubeSearchLive(key, {
      q: search.q,
      maxResults: Math.min(limit, 15),
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

  const viewerMap = await enrichViewerCounts(
    key,
    merged.map((m) => m.videoId),
  );

  const streams: DiscoveredStream[] = merged.slice(0, limit).map((item) => ({
    id: `youtube-${item.videoId}`,
    provider: "youtube" as const,
    title: item.title,
    channel: item.channel,
    viewerCount: viewerMap.get(item.videoId) ?? 0,
    thumbnailUrl: item.thumb,
    watchUrl: `https://www.youtube.com/watch?v=${item.videoId}`,
    gameOrCategory: null,
  }));

  streams.sort((a, b) => b.viewerCount - a.viewerCount);

  if (streams.length === 0 && !lastError) {
    lastError = "No live YouTube streams returned right now. Try again in a few minutes.";
  }

  return { streams, configured: true, error: streams.length === 0 ? lastError : null };
}

/** @deprecated use fetchDiscoveredStreamsWithMeta */
export async function fetchDiscoveredStreams(opts?: {
  youtubeLimit?: number;
}): Promise<DiscoveredStream[]> {
  const result = await fetchDiscoveredStreamsWithMeta(opts);
  return result.streams;
}
