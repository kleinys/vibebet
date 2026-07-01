/** Referral reward amounts — must match phase 19 SQL (_pay_referral_vibe). */

export const REFERRAL_REWARDS = {
  signupVibe: 100,
  firstBetVibe: 250,
} as const;

export const REFERRAL_TOTAL_VIBE_PER_FRIEND =
  REFERRAL_REWARDS.signupVibe + REFERRAL_REWARDS.firstBetVibe;

/** One-line for header / chips */
export function referralRewardsShort(): string {
  return `+${REFERRAL_REWARDS.signupVibe} ◉ signup · +${REFERRAL_REWARDS.firstBetVibe} ◉ first bet`;
}

/** Strip / card copy */
export function referralRewardsBlurb(): string {
  return `Friends join with your code (like a personal invite link). You earn ${REFERRAL_REWARDS.signupVibe} VIBE when they sign up and ${REFERRAL_REWARDS.firstBetVibe} VIBE when they place their first bet — up to ${REFERRAL_TOTAL_VIBE_PER_FRIEND} VIBE per friend. Play-money only, not USD cash.`;
}

/** Duel + invite combined hint */
export function playerCodeHint(referralsOn: boolean): string {
  if (referralsOn) {
    return `Challenge you in duels, or share at signup to earn VIBE. ${referralRewardsShort()}.`;
  }
  return "Friends enter this when posting a duel to challenge you directly.";
}
