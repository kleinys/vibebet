export const SKIN_STYLES: Record<
  string,
  { ring: string; glow: string; avatar: string }
> = {
  "default-oracle": {
    ring: "ring-fuchsia-500/40",
    glow: "shadow-fuchsia-500/20",
    avatar: "◆",
  },
  "oracle-sage": {
    ring: "ring-fuchsia-500/40",
    glow: "shadow-fuchsia-500/20",
    avatar: "◈",
  },
  "oracle-lunar": {
    ring: "ring-indigo-400/50",
    glow: "shadow-indigo-400/25",
    avatar: "☽",
  },
  "oracle-solar": {
    ring: "ring-amber-400/50",
    glow: "shadow-amber-400/25",
    avatar: "☀",
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
  "cosmic-oracle": {
    ring: "ring-indigo-400/70",
    glow: "shadow-indigo-400/35",
    avatar: "✧",
  },
  "ember-knight": {
    ring: "ring-orange-500/60",
    glow: "shadow-orange-500/30",
    avatar: "⚔",
  },
};

export const BADGE_STYLES: Record<
  string,
  { ring: string; icon: string; label: string }
> = {
  "founder-badge": {
    ring: "ring-amber-400/80 bg-amber-500/20",
    icon: "👑",
    label: "Founder",
  },
  "verified-seer": {
    ring: "ring-sky-400/80 bg-sky-500/20",
    icon: "✓",
    label: "Verified",
  },
};

export const SHIELD_STYLE = {
  ring: "ring-emerald-400/50",
  glow: "shadow-emerald-400/25",
  avatar: "🛡",
};

export function skinStyleForSlug(slug: string | undefined) {
  return SKIN_STYLES[slug ?? "default-oracle"] ?? SKIN_STYLES["default-oracle"]!;
}

export function badgeStyleForSlug(slug: string | undefined) {
  if (!slug) return null;
  return BADGE_STYLES[slug] ?? null;
}

export function previewSlugForItem(
  kind: string,
  slug: string,
): { skinSlug?: string; badgeSlug?: string } {
  if (kind === "skin") return { skinSlug: slug };
  if (kind === "badge") return { badgeSlug: slug };
  if (kind === "shield") return {};
  return { skinSlug: slug };
}
