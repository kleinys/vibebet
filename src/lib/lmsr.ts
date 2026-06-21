/**
 * LMSR math — mirrors Postgres helpers in migration 9b.
 * Used for categorical market price display + trade preview.
 */

function logSumExp(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const max = Math.max(...xs);
  let sum = 0;
  for (const x of xs) sum += Math.exp(x - max);
  return max + Math.log(sum);
}

/** Probability of each outcome given shares-sold vector q and liquidity b. */
export function lmsrPrices(q: number[], b: number): number[] {
  if (q.length === 0 || b <= 0) return [];
  const xs = q.map((qi) => qi / b);
  const logS = logSumExp(xs);
  return xs.map((x) => Math.exp(x - logS));
}

/** Shares received on outcome i for exactly `cost` VIBE. */
export function lmsrSharesForCost(
  q: number[],
  b: number,
  outcomeIndex: number,
  cost: number,
): number {
  if (cost <= 0 || q.length < 2 || b <= 0) return 0;
  if (outcomeIndex < 0 || outcomeIndex >= q.length) return 0;

  const xs = q.map((qi) => qi / b);
  const logS = logSumExp(xs);
  const xI = xs[outcomeIndex]!;
  const xsMinusI = xs.filter((_, i) => i !== outcomeIndex);
  const logSMinusI = logSumExp(xsMinusI);

  const aMinusB = logS + cost / b - logSMinusI;
  if (aMinusB <= 0) return 0;

  const logNumerator = logSMinusI + Math.log(Math.exp(aMinusB) - 1);
  const delta = b * (logNumerator - xI);
  return delta > 0 ? Math.floor(delta) : 0;
}

export function formatOutcomeProbability(p: number): string {
  return `${Math.round(p * 100)}%`;
}
