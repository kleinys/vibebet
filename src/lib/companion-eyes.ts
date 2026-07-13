/** Per-skin mystic eye themes — client-safe, no server-only. */

export type MysticEyeVariant = "round" | "slit" | "visor" | "void" | "cosmic";
export type MysticEyeStreakMode = "none" | "active" | "urgent";

export interface MysticEyeTheme {
  leftIris: string;
  rightIris: string;
  pupil: MysticEyeVariant;
  halo: string;
  /** 0–1 glow intensity baseline */
  intensity: number;
}

const THEMES: Record<string, MysticEyeTheme> = {
  "default-oracle": {
    leftIris: "#a78bfa",
    rightIris: "#fbbf24",
    pupil: "round",
    halo: "#c4b5fd",
    intensity: 0.85,
  },
  "oracle-sage": {
    leftIris: "#38bdf8",
    rightIris: "#fbbf24",
    pupil: "round",
    halo: "#7dd3fc",
    intensity: 0.8,
  },
  "oracle-lunar": {
    leftIris: "#e2e8f0",
    rightIris: "#6366f1",
    pupil: "round",
    halo: "#c7d2fe",
    intensity: 0.75,
  },
  "oracle-solar": {
    leftIris: "#fde047",
    rightIris: "#fff7ed",
    pupil: "round",
    halo: "#fcd34d",
    intensity: 1,
  },
  "neon-seer": {
    leftIris: "#22d3ee",
    rightIris: "#e879f9",
    pupil: "visor",
    halo: "#67e8f9",
    intensity: 0.95,
  },
  "void-prophet": {
    leftIris: "#1e1b4b",
    rightIris: "#7c3aed",
    pupil: "void",
    halo: "#4c1d95",
    intensity: 0.7,
  },
  "cosmic-oracle": {
    leftIris: "#60a5fa",
    rightIris: "#fbbf24",
    pupil: "cosmic",
    halo: "#818cf8",
    intensity: 1,
  },
  "ember-knight": {
    leftIris: "#fb923c",
    rightIris: "#dc2626",
    pupil: "slit",
    halo: "#fdba74",
    intensity: 0.9,
  },
  "frost-walker": {
    leftIris: "#67e8f9",
    rightIris: "#bae6fd",
    pupil: "round",
    halo: "#a5f3fc",
    intensity: 0.8,
  },
  "storm-titan": {
    leftIris: "#94a3b8",
    rightIris: "#fbbf24",
    pupil: "round",
    halo: "#cbd5e1",
    intensity: 0.85,
  },
  "nebula-ronin": {
    leftIris: "#e879f9",
    rightIris: "#2dd4bf",
    pupil: "slit",
    halo: "#f0abfc",
    intensity: 0.9,
  },
  "blood-moon": {
    leftIris: "#f87171",
    rightIris: "#1c1917",
    pupil: "slit",
    halo: "#fca5a5",
    intensity: 0.85,
  },
  "aurora-sage": {
    leftIris: "#34d399",
    rightIris: "#2dd4bf",
    pupil: "round",
    halo: "#6ee7b7",
    intensity: 0.8,
  },
};

export function mysticEyeTheme(skinSlug: string): MysticEyeTheme {
  return THEMES[skinSlug] ?? THEMES["default-oracle"];
}

export function mysticEyeStreakMode(
  currentStreak: number,
  lastActiveDate: string | null,
): MysticEyeStreakMode {
  if (currentStreak <= 0) return "none";
  const today = new Date().toISOString().slice(0, 10);
  if (lastActiveDate === today) return "active";
  const hour = new Date().getUTCHours();
  return hour >= 16 ? "urgent" : "active";
}

export function mysticEyeIntensity(
  theme: MysticEyeTheme,
  streakMode: MysticEyeStreakMode,
): number {
  const base = theme.intensity;
  if (streakMode === "active") return Math.min(1, base * 1.15);
  if (streakMode === "urgent") return Math.max(0.35, base * 0.55);
  return base * 0.75;
}
