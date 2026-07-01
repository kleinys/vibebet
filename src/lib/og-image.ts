import { getSiteUrl } from "@/lib/site-url";
export type ShareCardKind =
  | "profile"
  | "streak"
  | "challenge"
  | "win"
  | "companion";

export type OgImageParams = {
  kind: ShareCardKind;
  name: string;
  headline?: string;
  streak?: number;
  subline?: string;
};

export function ogImageUrl(params: OgImageParams): string {
  const q = new URLSearchParams();
  q.set("kind", params.kind);
  q.set("name", params.name.slice(0, 40));
  if (params.headline) q.set("headline", params.headline.slice(0, 80));
  if (params.streak != null) q.set("streak", String(Math.max(0, Math.min(9999, params.streak))));
  if (params.subline) q.set("subline", params.subline.slice(0, 100));
  return `${getSiteUrl()}/api/og?${q.toString()}`;
}

export function ogKindLabel(kind: ShareCardKind): string {
  switch (kind) {
    case "streak":
      return "Streak";
    case "challenge":
      return "Challenge";
    case "win":
      return "Win";
    case "companion":
      return "Companion";
    default:
      return "Profile";
  }
}

export function ogKindEmoji(kind: ShareCardKind): string {
  switch (kind) {
    case "streak":
      return "🔥";
    case "challenge":
      return "⚔";
    case "win":
      return "🎯";
    case "companion":
      return "✨";
    default:
      return "🎮";
  }
}
