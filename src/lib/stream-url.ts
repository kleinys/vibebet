/** Parse stream URLs into embed iframe src (YouTube, Twitch, Kick, Vimeo, etc.). */

export type StreamProvider =
  | "youtube"
  | "twitch"
  | "kick"
  | "vimeo"
  | "facebook"
  | "dailymotion"
  | "rumble"
  | "iframe"
  | "none";

export interface ParsedStream {
  provider: StreamProvider;
  embedUrl: string | null;
  watchUrl: string | null;
  label: string;
}

const PROVIDER_LABELS: Record<StreamProvider, string> = {
  youtube: "YouTube",
  twitch: "Twitch",
  kick: "Kick",
  vimeo: "Vimeo",
  facebook: "Facebook",
  dailymotion: "Dailymotion",
  rumble: "Rumble",
  iframe: "Embedded stream",
  none: "External link",
};

export function streamProviderLabel(provider: StreamProvider): string {
  return PROVIDER_LABELS[provider];
}

function parentHost(): string {
  if (typeof window !== "undefined") return window.location.hostname;
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, "").split("/")[0] ?? "localhost";
}

/** Twitch requires parent= for each allowed embed domain (repeat param). */
export function twitchParentQuery(): string {
  const hosts = new Set<string>();

  if (typeof window !== "undefined") {
    hosts.add(window.location.hostname);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl) {
    try {
      hosts.add(new URL(siteUrl).hostname);
    } catch {
      /* ignore */
    }
  }

  const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL?.trim() ?? process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    hosts.add(vercelUrl.replace(/^https?:\/\//, "").split("/")[0]);
  }

  hosts.add("localhost");

  return [...hosts]
    .filter(Boolean)
    .map((h) => `parent=${encodeURIComponent(h)}`)
    .join("&");
}

function twitchChannelEmbed(channel: string): string {
  return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&${twitchParentQuery()}&autoplay=true&muted=false`;
}

function twitchVideoEmbed(videoId: string): string {
  return `https://player.twitch.tv/?video=${encodeURIComponent(videoId)}&${twitchParentQuery()}&autoplay=true&muted=false`;
}

export function parseStreamUrl(raw: string | null | undefined): ParsedStream {
  if (!raw?.trim()) {
    return { provider: "none", embedUrl: null, watchUrl: null, label: PROVIDER_LABELS.none };
  }

  const trimmed = raw.trim();

  // Direct iframe / player URLs pasted by host
  if (/^https?:\/\/player\./i.test(trimmed) || /\/embed\//i.test(trimmed)) {
    return {
      provider: "iframe",
      embedUrl: trimmed,
      watchUrl: trimmed,
      label: PROVIDER_LABELS.iframe,
    };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { provider: "none", embedUrl: null, watchUrl: trimmed, label: PROVIDER_LABELS.none };
  }

  const host = url.hostname.replace(/^www\./, "");
  const parent = parentHost();

  // —— YouTube ——
  if (host === "youtube.com" || host === "m.youtube.com") {
    const id =
      url.searchParams.get("v") ??
      (url.pathname.startsWith("/live/") ? url.pathname.split("/")[2] : null) ??
      (url.pathname.startsWith("/embed/") ? url.pathname.split("/")[2] : null) ??
      (url.pathname.startsWith("/shorts/") ? url.pathname.split("/")[2] : null);
    if (id) {
      return {
        provider: "youtube",
        embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`,
        watchUrl: trimmed,
        label: PROVIDER_LABELS.youtube,
      };
    }
  }

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    if (id) {
      return {
        provider: "youtube",
        embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`,
        watchUrl: trimmed,
        label: PROVIDER_LABELS.youtube,
      };
    }
  }

  // —— Twitch ——
  if (host === "twitch.tv") {
    const parts = url.pathname.split("/").filter(Boolean);
    const channel = parts[0];
    if (channel && !["videos", "directory", "settings", "popout"].includes(channel)) {
      return {
        provider: "twitch",
        embedUrl: twitchChannelEmbed(channel),
        watchUrl: trimmed,
        label: PROVIDER_LABELS.twitch,
      };
    }
    if (parts[0] === "videos" && parts[1]) {
      return {
        provider: "twitch",
        embedUrl: twitchVideoEmbed(parts[1]),
        watchUrl: trimmed,
        label: PROVIDER_LABELS.twitch,
      };
    }
  }

  if (host === "player.twitch.tv") {
    const parentQuery = twitchParentQuery();
    const base = trimmed.split("?")[0];
    const qs = new URLSearchParams(trimmed.includes("?") ? trimmed.split("?")[1] : "");
    for (const pair of parentQuery.split("&")) {
      const [k, v] = pair.split("=");
      if (k === "parent") qs.append("parent", decodeURIComponent(v ?? ""));
    }
    if (!qs.has("autoplay")) qs.set("autoplay", "true");
    const embedUrl = `${base}?${qs.toString()}`;
    return {
      provider: "twitch",
      embedUrl,
      watchUrl: trimmed,
      label: PROVIDER_LABELS.twitch,
    };
  }

  // —— Kick ——
  if (host === "kick.com") {
    const channel = url.pathname.split("/").filter(Boolean)[0];
    if (channel && !["categories", "browse", "dashboard"].includes(channel)) {
      return {
        provider: "kick",
        embedUrl: `https://player.kick.com/${encodeURIComponent(channel)}`,
        watchUrl: trimmed,
        label: PROVIDER_LABELS.kick,
      };
    }
  }

  // —— Vimeo ——
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id =
      host === "player.vimeo.com"
        ? url.pathname.split("/").filter(Boolean)[0]
        : url.pathname.split("/").filter(Boolean).pop();
    if (id && /^\d+$/.test(id)) {
      return {
        provider: "vimeo",
        embedUrl: `https://player.vimeo.com/video/${id}?autoplay=0`,
        watchUrl: trimmed,
        label: PROVIDER_LABELS.vimeo,
      };
    }
  }

  // —— Facebook ——
  if (host === "facebook.com" || host === "fb.watch" || host === "m.facebook.com") {
    return {
      provider: "facebook",
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(trimmed)}&show_text=false`,
      watchUrl: trimmed,
      label: PROVIDER_LABELS.facebook,
    };
  }

  // —— Dailymotion ——
  if (host === "dailymotion.com" || host === "dai.ly") {
    let id: string | null = null;
    if (host === "dai.ly") {
      id = url.pathname.slice(1).split("/")[0];
    } else {
      const m = url.pathname.match(/\/video\/([^/?]+)/);
      id = m?.[1] ?? null;
    }
    if (id) {
      return {
        provider: "dailymotion",
        embedUrl: `https://www.dailymotion.com/embed/video/${id}`,
        watchUrl: trimmed,
        label: PROVIDER_LABELS.dailymotion,
      };
    }
  }

  // —— Rumble ——
  if (host === "rumble.com") {
    const slug = url.pathname.split("/").filter(Boolean).pop();
    if (slug) {
      return {
        provider: "rumble",
        embedUrl: `https://rumble.com/embed/${slug}/`,
        watchUrl: trimmed,
        label: PROVIDER_LABELS.rumble,
      };
    }
  }

  return { provider: "none", embedUrl: null, watchUrl: trimmed, label: PROVIDER_LABELS.none };
}

export const LIVE_EVENT_CATEGORIES = [
  { id: "sports", label: "Sports", icon: "🏐" },
  { id: "poker", label: "Poker", icon: "🃏" },
  { id: "chess", label: "Chess", icon: "♟️" },
  { id: "esports", label: "Esports", icon: "🎮" },
  { id: "other", label: "Other", icon: "📺" },
] as const;

export const SUPPORTED_STREAM_HINT =
  "YouTube, Twitch, Kick, Vimeo, Facebook Live, Dailymotion, Rumble, or direct player/embed URLs";
