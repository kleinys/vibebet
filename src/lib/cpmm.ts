/**
 * CPMM (Constant Product Market Maker) math for binary markets.
 *
 * This file mirrors the math in `supabase/migrations/20260102000000_markets.sql`.
 * If you change one, change both. The DB is authoritative — this module is
 * used only for UI previews (showing "you will receive ~X shares" before the
 * user clicks Buy).
 *
 * Convention:
 *   - `yes` and `no` reserves are BIGINT in the DB; we use `number` here.
 *     For all realistic Phase 1 inputs (subsidy ≤ 1M, cost ≤ 1M) this stays
 *     well under Number.MAX_SAFE_INTEGER. If we ever raise those caps, switch
 *     this module to `bigint`.
 *   - "side" is which outcome the user is buying.
 */

export type Side = "yes" | "no";

export interface PoolState {
  reserveYes: number;
  reserveNo: number;
}

export function yesPrice(pool: PoolState): number {
  const total = pool.reserveYes + pool.reserveNo;
  return total === 0 ? 0.5 : pool.reserveNo / total;
}

export function priceForSide(pool: PoolState, side: Side): number {
  const p = yesPrice(pool);
  return side === "yes" ? p : 1 - p;
}

/**
 * Compute how many shares the user receives for `cost` VIBE bet on `side`.
 * Returns the floored integer (matches the SQL).
 */
export function quoteSharesOut(
  pool: PoolState,
  side: Side,
  cost: number,
): number {
  if (cost <= 0) return 0;
  const reserveIn = side === "yes" ? pool.reserveYes : pool.reserveNo;
  const reserveOut = side === "yes" ? pool.reserveNo : pool.reserveYes;
  const k = reserveIn * reserveOut;
  const shares = reserveIn + cost - k / (reserveOut + cost);
  return Math.floor(shares);
}

/**
 * Compute the new pool state after a trade. Returned reserves are integers,
 * matching the DB's stored representation.
 */
export function applyTrade(
  pool: PoolState,
  side: Side,
  cost: number,
): { shares: number; pool: PoolState } {
  const shares = quoteSharesOut(pool, side, cost);
  if (side === "yes") {
    return {
      shares,
      pool: {
        reserveYes: pool.reserveYes + cost - shares,
        reserveNo: pool.reserveNo + cost,
      },
    };
  }
  return {
    shares,
    pool: {
      reserveYes: pool.reserveYes + cost,
      reserveNo: pool.reserveNo + cost - shares,
    },
  };
}

/**
 * Average price paid per share for this trade.
 *   avgPrice = cost / shares
 * Always ≥ marginal price (otherwise the AMM would lose money).
 */
export function averagePrice(cost: number, shares: number): number {
  if (shares <= 0) return 1;
  return cost / shares;
}

/**
 * Quote VIBE proceeds for selling `shares` of `side` back to the AMM.
 *
 *   p = ((A + B) − √((A − B)² + 4K)) / 2
 *
 * where A = reserve_in + shares, B = reserve_out, K = reserve_in * reserve_out.
 * Returns the floored integer (matches the SQL).
 */
export function quoteProceedsForSell(
  pool: PoolState,
  side: Side,
  shares: number,
): number {
  if (shares <= 0) return 0;
  const reserveIn = side === "yes" ? pool.reserveYes : pool.reserveNo;
  const reserveOut = side === "yes" ? pool.reserveNo : pool.reserveYes;
  const k = reserveIn * reserveOut;
  const A = reserveIn + shares;
  const B = reserveOut;
  const proceeds = (A + B - Math.sqrt((A - B) ** 2 + 4 * k)) / 2;
  return Math.max(0, Math.floor(proceeds));
}

export function applySell(
  pool: PoolState,
  side: Side,
  shares: number,
): { proceeds: number; pool: PoolState } {
  const proceeds = quoteProceedsForSell(pool, side, shares);
  if (side === "yes") {
    return {
      proceeds,
      pool: {
        reserveYes: pool.reserveYes + shares - proceeds,
        reserveNo: pool.reserveNo - proceeds,
      },
    };
  }
  return {
    proceeds,
    pool: {
      reserveYes: pool.reserveYes - proceeds,
      reserveNo: pool.reserveNo + shares - proceeds,
    },
  };
}

export function formatPrice(p: number): string {
  return `${(p * 100).toFixed(1)}¢`;
}

export function formatProbability(p: number): string {
  return `${(p * 100).toFixed(0)}%`;
}
