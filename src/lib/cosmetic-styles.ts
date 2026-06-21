export const SKIN_STYLES: Record<
  string,
  { ring: string; glow: string; avatar: string }
> = {
  "default-oracle": {
    ring: "ring-fuchsia-500/40",
    glow: "shadow-fuchsia-500/20",
    avatar: "◆",
  },
  "neon-seer": {
    ring: "ring-cyan-400/60",
    glow: "shadow-cyan-400/30",
    avatar: "✦",
  },
  "void-prophet": {
    ring: "ring-violet-500/70",
    glow: "shadow-violet-500/40",
    avatar: "☽",
  },
  "founder-badge": {
    ring: "ring-amber-400/60",
    glow: "shadow-amber-400/30",
    avatar: "👑",
  },
};

export function skinStyleForSlug(slug: string | undefined) {
  return SKIN_STYLES[slug ?? "default-oracle"] ?? SKIN_STYLES["default-oracle"]!;
}
