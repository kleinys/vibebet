import { ImageResponse } from "next/og";
import type { ShareCardKind } from "@/lib/og-image";
import { ogKindEmoji, ogKindLabel } from "@/lib/og-image";

export const runtime = "edge";

const VALID_KINDS = new Set<ShareCardKind>([
  "profile",
  "streak",
  "challenge",
  "win",
  "companion",
]);

function clamp(value: string | null, max: number): string {
  if (!value) return "";
  return value.slice(0, max);
}

function titleFor(kind: ShareCardKind, name: string, headline: string, streak: number): string {
  switch (kind) {
    case "streak":
      return `${streak}-day streak`;
    case "challenge":
      return `Challenge ${name}`;
    case "win":
      return headline || "Big win";
    case "companion":
      return headline || "Trainer & companion";
    default:
      return name;
  }
}

function subtitleFor(
  kind: ShareCardKind,
  name: string,
  headline: string,
  streak: number,
  subline: string,
): string {
  if (subline) return subline;
  switch (kind) {
    case "streak":
      return `${name} is on fire — predict, duel, climb the Hall of Fame.`;
    case "challenge":
      return `Duels, markets, and skill games on Vibebet. Code them in.`;
    case "win":
      return `${name} just scored on Vibebet.`;
    case "companion":
      return `${name}'s trainer & companion on Vibebet.`;
    default:
      return "Play-money predictions & skill duels.";
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kindParam = searchParams.get("kind") ?? "profile";
  const kind = VALID_KINDS.has(kindParam as ShareCardKind)
    ? (kindParam as ShareCardKind)
    : "profile";
  const name = clamp(searchParams.get("name"), 40) || "Player";
  const headline = clamp(searchParams.get("headline"), 80);
  const subline = clamp(searchParams.get("subline"), 100);
  const streak = Math.max(0, Math.min(9999, Number(searchParams.get("streak") ?? 0) || 0));

  const title = titleFor(kind, name, headline, streak);
  const subtitle = subtitleFor(kind, name, headline, streak, subline);
  const emoji = ogKindEmoji(kind);
  const badge = ogKindLabel(kind);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 64px",
          background: "linear-gradient(135deg, #1e1035 0%, #020617 45%, #2d0a3d 100%)",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          color: "#f4f4f5",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: "linear-gradient(135deg, #a855f7, #ec4899)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              V
            </div>
            <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>Vibebet</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 18px",
              borderRadius: 999,
              border: "1px solid rgba(192,132,252,0.35)",
              background: "rgba(139,92,246,0.15)",
              fontSize: 22,
              fontWeight: 600,
              color: "#e9d5ff",
            }}
          >
            <span>{emoji}</span>
            <span>{badge}</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 980 }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: -2,
              color: "#fafafa",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 28,
              lineHeight: 1.45,
              color: "#a1a1aa",
              maxWidth: 900,
            }}
          >
            {subtitle}
          </div>
          {kind === "win" && headline && (
            <div
              style={{
                fontSize: 24,
                fontWeight: 600,
                color: "#34d399",
              }}
            >
              {name}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: 28,
          }}
        >
          <span style={{ fontSize: 24, color: "#71717a" }}>Play-money predictions & skill duels</span>
          <span style={{ fontSize: 24, fontWeight: 600, color: "#c084fc" }}>vibebet.app</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
