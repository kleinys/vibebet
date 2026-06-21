import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Currency } from "@/lib/supabase/types";

/**
 * Vibebet ledger
 * ==============
 * Single source of truth for all currency movements (VIBE + Gems).
 *
 * Design rules:
 *   1. Append-only. No updates. No deletes. The DB enforces this with triggers.
 *   2. Double-entry. Every transaction's entries sum to zero per currency.
 *      The DB enforces this with a deferred constraint trigger.
 *   3. Idempotent. Every transaction has an `externalRef` (e.g. a Stripe event
 *      ID, "signup_bonus:<user_id>", "market_settle:<market_id>"). A repeated
 *      post with the same ref is a no-op and returns the existing transaction.
 *   4. Balances are DERIVED, never cached. The `user_balances` view is the
 *      source of truth for what a user owns.
 *
 * Accounts:
 *   - user_wallet     : one per (user, currency). Negative balance never allowed
 *                       — enforce in calling code before posting a debit.
 *   - system_mint     : where free currency is issued (signup bonus, rewards).
 *   - system_burn     : where currency is destroyed (e.g. spending Gems on
 *                       cosmetics is a debit from the user wallet, credit to
 *                       a burn account — Gems leave circulation).
 *   - system_revenue  : tracks USD value of Gem purchases (in metadata).
 */

export type AccountRef =
  | { kind: "user_wallet"; userId: string; currency: Currency }
  | {
      kind: "system_mint" | "system_burn" | "system_revenue";
      currency: Currency;
      code: string;
    };

export interface LedgerEntry {
  account: AccountRef;
  amount: number;
  currency: Currency;
}

export interface PostOptions {
  kind: string;
  externalRef: string;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
  entries: LedgerEntry[];
}

export interface PostResult {
  transactionId: string;
  alreadyPosted: boolean;
}

export class LedgerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "LedgerError";
  }
}

function assertSafeAmount(amount: number) {
  if (!Number.isInteger(amount)) {
    throw new LedgerError(
      `amount must be an integer, got ${amount}`,
      "non_integer_amount",
    );
  }
  if (Math.abs(amount) > Number.MAX_SAFE_INTEGER) {
    throw new LedgerError(
      "amount exceeds JS safe integer range",
      "amount_too_large",
    );
  }
}

function validateBalanced(entries: LedgerEntry[]) {
  if (entries.length < 2) {
    throw new LedgerError(
      "ledger transaction needs at least 2 entries",
      "too_few_entries",
    );
  }
  const sums = new Map<Currency, number>();
  for (const entry of entries) {
    assertSafeAmount(entry.amount);
    if (entry.currency !== entry.account.currency) {
      throw new LedgerError(
        `entry currency ${entry.currency} does not match account currency ${entry.account.currency}`,
        "currency_mismatch",
      );
    }
    sums.set(entry.currency, (sums.get(entry.currency) ?? 0) + entry.amount);
  }
  for (const [currency, total] of sums) {
    if (total !== 0) {
      throw new LedgerError(
        `ledger entries do not balance for ${currency}: sum = ${total}`,
        "unbalanced",
      );
    }
  }
}

async function resolveAccountId(ref: AccountRef): Promise<string> {
  const supabase = createAdminClient();
  if (ref.kind === "user_wallet") {
    const { data, error } = await supabase
      .from("accounts")
      .select("id")
      .eq("kind", "user_wallet")
      .eq("currency", ref.currency)
      .eq("owner_user_id", ref.userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new LedgerError(
        `user wallet not found for user=${ref.userId} currency=${ref.currency}`,
        "wallet_not_found",
      );
    }
    return data.id;
  }

  // System account: get or create.
  const { data: existing, error: selErr } = await supabase
    .from("accounts")
    .select("id")
    .eq("kind", ref.kind)
    .eq("currency", ref.currency)
    .eq("code", ref.code)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) return existing.id;

  const { data: created, error: insErr } = await supabase
    .from("accounts")
    .insert({ kind: ref.kind, currency: ref.currency, code: ref.code })
    .select("id")
    .single();
  if (insErr) throw insErr;
  return created.id;
}

/**
 * Post a transaction to the ledger.
 *
 * @returns The transaction id and whether this was a fresh post or a repeat
 *          (already posted under this externalRef).
 */
export async function post(opts: PostOptions): Promise<PostResult> {
  validateBalanced(opts.entries);

  const supabase = createAdminClient();

  // Idempotency: if a transaction already exists for this externalRef, return
  // it without writing anything new.
  const { data: existing, error: lookupErr } = await supabase
    .from("ledger_transactions")
    .select("id")
    .eq("external_ref", opts.externalRef)
    .maybeSingle();
  if (lookupErr) throw lookupErr;
  if (existing) {
    return { transactionId: existing.id, alreadyPosted: true };
  }

  // Resolve all account references upfront so we fail fast if any are bad.
  const accountIds = await Promise.all(
    opts.entries.map((e) => resolveAccountId(e.account)),
  );

  const { data: txn, error: txnErr } = await supabase
    .from("ledger_transactions")
    .insert({
      kind: opts.kind,
      external_ref: opts.externalRef,
      metadata: opts.metadata ?? {},
      created_by: opts.createdBy ?? null,
    })
    .select("id")
    .single();
  if (txnErr) {
    // Race: another worker just posted the same externalRef. Re-read and
    // return that transaction.
    if (txnErr.code === "23505") {
      const { data: raced } = await supabase
        .from("ledger_transactions")
        .select("id")
        .eq("external_ref", opts.externalRef)
        .single();
      if (raced) return { transactionId: raced.id, alreadyPosted: true };
    }
    throw txnErr;
  }

  const entryRows = opts.entries.map((entry, i) => ({
    transaction_id: txn.id,
    account_id: accountIds[i],
    amount: entry.amount,
    currency: entry.currency,
  }));

  const { error: entriesErr } = await supabase
    .from("ledger_entries")
    .insert(entryRows);

  if (entriesErr) {
    throw new LedgerError(
      `failed to insert ledger entries: ${entriesErr.message}`,
      "entries_insert_failed",
    );
  }

  return { transactionId: txn.id, alreadyPosted: false };
}

/**
 * Read a user's balance for a currency. Reads the derived `user_balances`
 * view (always recomputed; never cached on writes).
 */
export async function getBalance(
  userId: string,
  currency: Currency,
): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("user_balances")
    .select("balance")
    .eq("user_id", userId)
    .eq("currency", currency)
    .maybeSingle();
  if (error) throw error;
  return data?.balance ?? 0;
}

export async function getAllBalances(
  userId: string,
): Promise<Record<Currency, number>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("user_balances")
    .select("currency, balance")
    .eq("user_id", userId);
  if (error) throw error;
  const balances: Record<Currency, number> = { vibe: 0, gem: 0 };
  for (const row of data ?? []) {
    if (row.currency && row.balance !== null) {
      balances[row.currency] = row.balance;
    }
  }
  return balances;
}
