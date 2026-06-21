/** Flat cancel-bet payout: 50% of cost basis returned, 50% fee. Must match SQL quick_exit_shares. */
export const CANCEL_BET_PAYOUT_RATIO = 0.5;

export function quoteCancelBet(costBasis: number): {
  proceeds: number;
  fee: number;
} {
  const proceeds = Math.floor(costBasis * CANCEL_BET_PAYOUT_RATIO);
  return { proceeds, fee: costBasis - proceeds };
}
