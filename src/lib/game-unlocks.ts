/**
 * Trinity-complete loadouts unlock extra game modes.
 * Buff % stacks on that game's stake cap / XP — separate from locker EV buff.
 */

export interface GameUnlock {
  id: string;
  title: string;
  href: string;
  emoji: string;
  /** Minimum completed trinities (all 3 pieces same theme). */
  trinitiesRequired: number;
  /** Optional: specific theme rank floor. */
  minThemeRank?: number;
  /** In-game perk when playing with matching equipped trinity. */
  perk: string;
  /** Extra perk if theme rank >= 7 (locker buff tier). */
  highRankPerk?: string;
}

export const TRINITY_GAME_UNLOCKS: GameUnlock[] = [
  {
    id: "duels-base",
    title: "Duel hub",
    href: "/games/duels",
    emoji: "⚔️",
    trinitiesRequired: 0,
    perk: "Always open",
  },
  {
    id: "arcade",
    title: "Arcade (coin flip, dice)",
    href: "/games/arcade",
    emoji: "🎰",
    trinitiesRequired: 1,
    perk: "+5% max stake on arcade",
    highRankPerk: "Volatile trinity: double-or-nothing once per day",
  },
  {
    id: "trivia-blitz",
    title: "Trivia Blitz duels",
    href: "/games/duels/trivia",
    emoji: "🧠",
    trinitiesRequired: 2,
    perk: "Steady trinity: 1 free hint per match",
    highRankPerk: "Arcane trinity: skip one wrong-answer penalty",
  },
  {
    id: "lightning-duels",
    title: "Lightning duels",
    href: "/games/duels/lightning",
    emoji: "⚡",
    trinitiesRequired: 3,
    perk: "Streak trinity: +1 round if you won last duel",
    highRankPerk: "Rank 7+: momentum carries to locker wheel",
  },
  {
    id: "poker-spectator",
    title: "Poker spectator markets",
    href: "/games/duels/poker",
    emoji: "🃏",
    trinitiesRequired: 4,
    perk: "Bet on hand strength tiers",
    highRankPerk: "Rank 8+: reduced vig on spectator bets",
  },
  {
    id: "live-arena-pro",
    title: "Live Arena multi-window",
    href: "/games",
    emoji: "📈",
    trinitiesRequired: 5,
    perk: "3 simultaneous Up/Down windows",
    highRankPerk: "Rank 9+: 15s early window on new strikes",
  },
  {
    id: "host-stream",
    title: "Host watch-and-bet",
    href: "/games/create",
    emoji: "📺",
    trinitiesRequired: 6,
    perk: "Create public streams with side markets",
    highRankPerk: "Rank 10+: featured slot on /live for 24h",
  },
];

export function countCompleteTrinities(ownedSlugs: Set<string>, themes: { skinSlug: string; rank: number }[]): number {
  let n = 0;
  for (const t of themes) {
    if (t.rank === 0) {
      if (ownedSlugs.has(t.skinSlug)) n++;
      continue;
    }
    if (
      ownedSlugs.has(t.skinSlug) &&
      ownedSlugs.has(`${t.skinSlug}--animal`) &&
      ownedSlugs.has(`${t.skinSlug}--phenomenon`)
    ) {
      n++;
    }
  }
  return n;
}

export function unlockedGames(completeTrinities: number): GameUnlock[] {
  return TRINITY_GAME_UNLOCKS.filter((g) => completeTrinities >= g.trinitiesRequired);
}
