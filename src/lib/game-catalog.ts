/** Master catalog for duel / arcade games — single source for hub UI. */

export type GameKind = "luck" | "skill" | "prediction" | "oracle";
export type GameStatus = "live" | "coming_soon" | "beta";

export interface GameDefinition {
  key: string;
  name: string;
  emoji: string;
  kind: GameKind;
  status: GameStatus;
  description: string;
  href: string | null;
  flag?: string;
  minStake?: number;
  maxStake?: number;
  supportsMatchmaking?: boolean;
}

export const GAME_CATALOG: GameDefinition[] = [
  {
    key: "rps",
    name: "Rock Paper Scissors",
    emoji: "✊",
    kind: "luck",
    status: "live",
    description: "Pick your move. Winner takes 90% of the pool. Draw = full refund.",
    href: "/games/duels/rps",
    flag: "game_layer_enabled",
    supportsMatchmaking: false,
  },
  {
    key: "high_card",
    name: "High Card",
    emoji: "🃏",
    kind: "luck",
    status: "live",
    description: "Draw a card (1–13). Higher card wins. Ties reroll once.",
    href: "/games/duels/high-card",
    flag: "game_layer_enabled",
    supportsMatchmaking: true,
  },
  {
    key: "dice",
    name: "Dice Duel",
    emoji: "🎲",
    kind: "luck",
    status: "live",
    description: "2d6 vs 2d6. Winner takes 90% of the pool.",
    href: "/games/arcade",
    flag: "arcade_games_enabled",
    supportsMatchmaking: true,
  },
  {
    key: "coin_flip",
    name: "Coin Flip",
    emoji: "🪙",
    kind: "luck",
    status: "live",
    description: "Heads or tails vs the house. Win = 1.8× stake.",
    href: "/games/arcade",
    flag: "arcade_games_enabled",
  },
  {
    key: "lightning_duel",
    name: "Lightning Duel",
    emoji: "⚡",
    kind: "oracle",
    status: "live",
    description: "60s BTC up/down head-to-head. Live price vs strike.",
    href: "/games/duels/lightning",
    flag: "game_layer_enabled",
  },
  {
    key: "connect4",
    name: "Connect Four",
    emoji: "🔴",
    kind: "skill",
    status: "live",
    description: "Drop discs — connect 4 in a row. Challenge friends by player code.",
    href: "/games/duels/connect4",
    flag: "connect4_enabled",
  },
  {
    key: "lightning",
    name: "Lightning Round",
    emoji: "⚡",
    kind: "oracle",
    status: "live",
    description: "Solo crypto up/down windows. Auto-settled from live price.",
    href: "/markets/fast",
    flag: "fast_markets_enabled",
  },
  {
    key: "liars_dice",
    name: "Liar's Dice",
    emoji: "🎲",
    kind: "luck",
    status: "live",
    description: "Bluff and bid — call liar to win the pot. 1s are wild.",
    href: "/games/duels/liars-dice",
    flag: "liars_dice_enabled",
  },
  {
    key: "chess",
    name: "Chess",
    emoji: "♟️",
    kind: "skill",
    status: "live",
    description: "Rated chess duels with ELO — challenge friends by player code.",
    href: "/games/duels/chess",
    flag: "chess_enabled",
  },
  {
    key: "checkers",
    name: "Checkers",
    emoji: "⬛",
    kind: "skill",
    status: "live",
    description: "American checkers — jump captures and king promotion.",
    href: "/games/duels/checkers",
    flag: "checkers_enabled",
  },
  {
    key: "go",
    name: "Go",
    emoji: "⚫",
    kind: "skill",
    status: "live",
    description: "9×9 Go — capture stones, pass-pass to score with komi.",
    href: "/games/duels/go",
    flag: "go_enabled",
  },
  {
    key: "shogi",
    name: "Shogi",
    emoji: "将",
    kind: "skill",
    status: "live",
    description: "Japanese chess with piece drops and promotions.",
    href: "/games/duels/shogi",
    flag: "shogi_enabled",
  },
  {
    key: "poker",
    name: "Hold'em Showdown",
    emoji: "🃏",
    kind: "skill",
    status: "live",
    description: "Heads-up Texas hold'em — ante, deal streets, best hand wins.",
    href: "/games/duels/poker",
    flag: "poker_enabled",
  },
];

export function liveGames(flags: Record<string, boolean>): GameDefinition[] {
  return GAME_CATALOG.filter((g) => {
    if (g.status !== "live") return false;
    if (!g.flag) return true;
    return flags[g.flag] === true;
  });
}

export function catalogGame(key: string): GameDefinition | undefined {
  return GAME_CATALOG.find((g) => g.key === key);
}
