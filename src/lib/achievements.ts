export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  emoji: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "first_trade",
    title: "First bet",
    description: "Place your first trade on any market.",
    emoji: "🎯",
  },
  {
    id: "first_market",
    title: "Market maker",
    description: "Create a prediction market.",
    emoji: "🏗️",
  },
  {
    id: "first_comment",
    title: "Voice in the crowd",
    description: "Post a comment on a market.",
    emoji: "💬",
  },
  {
    id: "streak_3",
    title: "Heating up",
    description: "Log in 3 days in a row.",
    emoji: "🔥",
  },
  {
    id: "streak_7",
    title: "On a roll",
    description: "Log in 7 days in a row.",
    emoji: "⚡",
  },
  {
    id: "streak_30",
    title: "Dedicated",
    description: "Log in 30 days in a row.",
    emoji: "👑",
  },
  {
    id: "volume_1k",
    title: "High roller",
    description: "Wager 1,000+ VIBE across all trades.",
    emoji: "💎",
  },
  {
    id: "accuracy_oracle",
    title: "Oracle",
    description: "55%+ accuracy on 10+ resolved bets.",
    emoji: "🔮",
  },
  {
    id: "accuracy_prophet",
    title: "Prophet",
    description: "65%+ accuracy on 50+ resolved bets.",
    emoji: "✨",
  },
  {
    id: "accuracy_legend",
    title: "Sharp Mind",
    description: "75%+ accuracy on 100+ resolved bets.",
    emoji: "🎯",
  },
];

export const ACHIEVEMENT_BY_ID = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a]),
) as Record<string, AchievementDef>;
