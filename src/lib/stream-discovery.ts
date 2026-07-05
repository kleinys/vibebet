import "server-only";

/**
 * Discover top live YouTube streams (read-only, like Polymarket gamma fetch).
 * Twitch skipped for now — enable later when 2FA + app registration is done.
 */

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

export async function fetchTopYouTubeLiveStreams(limit = 20): Promise<DiscoveredStream[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];

  const params = new URLSearchParams({
    part: "snippet",
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

export async function fetchDiscoveredStreams(opts?: {
  youtubeLimit?: number;
}): Promise<DiscoveredStream[]> {
  return fetchTopYouTubeLiveStreams(opts?.youtubeLimit ?? 20);
}

export function streamDiscoveryConfigured(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY);
}
