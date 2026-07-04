export type PlayerPath = "predict" | "compete" | "watch" | "trainer" | "explore";

export interface PlayerPathOption {
  id: PlayerPath;
  label: string;
  short: string;
  emoji: string;
  description: string;
  hubHref: string;
  createHref: string;
  onboardingBlurb: string;
  welcomeLine: string;
  howItWorks: string[];
  firstActionLabel: string;
  firstActionHref: string;
}

export const PLAYER_PATHS: PlayerPathOption[] = [
  {
    id: "predict",
    label: "Predict",
    short: "Predict",
    emoji: "📊",
    description: "Bet on markets, track odds, create questions.",
    hubHref: "/markets",
    createHref: "/markets/new",
    onboardingBlurb: "Browse Polymarket mirrors and official markets. Build reputation on accuracy and profit.",
    welcomeLine: "Pick a market, place a bet, watch the curve move.",
    howItWorks: [
      "Odds = crowd probability. 60% Yes means the market thinks there's a 60% chance.",
      "Buy the side you believe in. Winning shares pay 1 VIBE each at resolution.",
      "Your accuracy is tracked — climb Sharp Minds, not just profit.",
    ],
    firstActionLabel: "Open trending markets",
    firstActionHref: "/markets?sort=trending",
  },
  {
    id: "compete",
    label: "Compete",
    short: "Compete",
    emoji: "⚔️",
    description: "Head-to-head duels, skill games, and open challenges.",
    hubHref: "/games/duels",
    createHref: "/games/create",
    onboardingBlurb: "Post a VIBE stake duel or jump into chess, trivia, RPS, and more.",
    welcomeLine: "Challenge someone head-to-head — luck, skill, or prediction duels.",
    howItWorks: [
      "Post an open challenge or accept someone else's — stakes stay in escrow until the game ends.",
      "Skill games (chess, Connect 4, Go) use ELO ratings. Friendly mode skips rating changes.",
      "Spectators can bet on who's winning once a duel is live.",
    ],
    firstActionLabel: "Open duel hub",
    firstActionHref: "/games/duels",
  },
  {
    id: "watch",
    label: "Watch",
    short: "Watch",
    emoji: "📺",
    description: "Live crypto/stock windows and stream watch-and-bet.",
    hubHref: "/games",
    createHref: "/live",
    onboardingBlurb: "Auto-resolved Up/Down windows and live event betting — fast rounds, clear outcomes.",
    welcomeLine: "Watch live prices tick, bet Up or Down before the timer hits zero.",
    howItWorks: [
      "BTC, ETH, SOL (and stocks) get short windows — price vs strike at expiry decides the winner.",
      "Timers and live spot prices update automatically — no manual resolution.",
      "Live streams let groups watch together and bet on the same market.",
    ],
    firstActionLabel: "Enter Live Arena",
    firstActionHref: "/games",
  },
  {
    id: "trainer",
    label: "Trainer & locker",
    short: "Locker",
    emoji: "🎭",
    description: "Equip skins, spirit animals, VIBE case & daily wheel.",
    hubHref: "/account/profile#trainer",
    createHref: "/account/profile#locker-rewards",
    onboardingBlurb: "Your trainer loadout changes orbit phenomena and locker gambling modifiers.",
    welcomeLine: "Equip a skin — your orbit aura shifts the VIBE case and wheel.",
    howItWorks: [
      "Each trainer pairs a unique spirit animal and orbit phenomenon.",
      "Your equipped skin applies an affinity modifier to the VIBE case and wheel.",
      "Collect skins to unlock different gambling playstyles.",
    ],
    firstActionLabel: "Open trainer & locker",
    firstActionHref: "/account/profile#trainer",
  },
];

export const EXPLORE_PATH: PlayerPathOption = {
  id: "explore",
  label: "Explore all",
  short: "Explore",
  emoji: "✨",
  description: "See everything — switch modes anytime from the top bar.",
  hubHref: "/",
  createHref: "/markets/new",
  onboardingBlurb: "No single lane — browse markets, duels, and live games freely.",
  welcomeLine: "Explore markets, duels, and live games — pick a lane whenever you want.",
  howItWorks: [
    "Use the Predict / Compete / Watch bar at the top to jump between modes.",
    "Your companion, streak, and VIBE balance follow you everywhere.",
    "Nothing is locked — change your focus in one click.",
  ],
  firstActionLabel: "Browse home",
  firstActionHref: "/",
};

export function pathOption(id: PlayerPath | string | null | undefined): PlayerPathOption {
  if (id === "explore" || !id) return EXPLORE_PATH;
  return PLAYER_PATHS.find((p) => p.id === id) ?? EXPLORE_PATH;
}

export function hubForPath(id: PlayerPath | string | null | undefined): string {
  return pathOption(id).hubHref;
}

export function pathFromPathname(pathname: string): PlayerPath | null {
  if (pathname.startsWith("/markets") || pathname.startsWith("/court")) return "predict";
  if (
    pathname.startsWith("/games/duels") ||
    pathname.startsWith("/duels") ||
    pathname.startsWith("/games/create")
  ) {
    return "compete";
  }
  if (pathname.startsWith("/games") || pathname.startsWith("/live")) return "watch";
  if (pathname.startsWith("/account/profile")) return "trainer";
  return null;
}
