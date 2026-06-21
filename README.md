# Vibebet — Phases 0 through 2.5

A play-money prediction market with a closed-loop virtual economy (Roblox / Clash Royale model). VIBE Points are earned. Gems are bought. Nothing is ever withdrawn or transferred.

- **Phase 0** — Foundation: auth, double-entry ledger, RLS, feature flags, Stripe webhook scaffolding.
- **Phase 1** — Prediction markets: binary CPMM markets, atomic trades, admin resolution.
- **Phase 1.1** — Sell shares back to the AMM (buy + sell loop closed).
- **Phase 1.5** — Shop: Gem bundles via Stripe Checkout + cosmetic items + inventory.
- **Phase 2** — Core social: market comments, leaderboard, account page.
- **Phase 2.5** — Polymarket-style discovery: categories, search, sort tabs, 24h stats, custom Yes/No labels, featured/breaking sections.
- **Phase 3 entry** — Error boundaries, loading skeletons, admin flag toggle UI.

## Stack

- Next.js 16 (app router), React 19, TypeScript, Tailwind v4
- Supabase (Postgres + Auth + RLS) via `@supabase/ssr`
- Stripe (server only, webhook scaffold)
- Zod for env validation, TanStack Query + Sonner for client state/toasts

## Phase 0 deliverables (foundation)

- [x] Next.js scaffold with strict TS and ESLint
- [x] Supabase SSR auth (email + password)
- [x] Auth pages: `/login`, `/signup`, `/auth/callback`, `/auth/signout`
- [x] Double-entry append-only ledger (`ledger_transactions`, `ledger_entries`)
- [x] Per-user wallets (`vibe` + `gem`), system mint/burn/revenue accounts
- [x] Balance view derived from the ledger (`user_balances`, `security_invoker`)
- [x] Strict RLS on every public table
- [x] 1,000 VIBE signup bonus, posted via the ledger
- [x] Feature flags table (`real_money_enabled` etc, all off by default)
- [x] Admin role check via JWT `app_metadata.role` (safe, not `user_metadata`)
- [x] Stripe webhook scaffold with signature verification + idempotency
- [x] Health check at `/healthz`
- [x] Admin shell at `/admin`

## Phase 1.1 / 1.5 / 2 / 3 deliverables (this session)

### Phase 1.1 — sell shares back
- `sell_shares` RPC with inverse CPMM math: `p = ((A+B) − √((A−B)² + 4K)) / 2`
- `total_proceeds` column on `positions`
- TradePanel has Buy/Sell tabs; sells show as negative cost in `trades`

### Phase 1.5 — shop & Gem economy
- Tables: `shop_items`, `user_inventory`, `gem_bundles` with full RLS
- `spend_gems_for_item` RPC posts a balanced ledger txn (user wallet → gem burn account)
- Stripe Checkout server action (`/shop` → hosted checkout → `/shop/success`)
- Webhook handles `checkout.session.completed` AND `payment_intent.succeeded`, both idempotent through the ledger's `external_ref` constraint
- Seeded: 4 Gem bundles ($0.99–$99.99), 3 skins (Default/Neon Seer/Void Prophet), Founder badge, Streak Shield

### Phase 2 — core social
- `market_comments` table with insert/delete RLS (`user_id = auth.uid()`)
- Comment thread on every market detail page
- `/leaderboard` page powered by a `leaderboard()` RPC (lifetime profit = payouts + proceeds − cost)
- `/account` page showing balances, open positions, inventory

### Phase 2.5 — Polymarket-style discovery (this session)
- **Categories** (Politics, Sports, Crypto, Tech, Entertainment, Finance, World, Culture, Other) on every market
- **Custom Yes/No labels** per market — e.g. "Up"/"Down", "Spain"/"France", "Trump"/"Harris"
- **Featured flag** for editorial curation; surfaces in the home hero
- **24h volume + 24h price change** computed on the fly from `trades.reserve_*_after` (no snapshot table needed)
- **Search** (server-side `ilike` on question text) wired into the header and `/markets`
- **Sort tabs**: Trending (24h volume), New, All-time volume, Closing soon
- **Polymarket-style home page**: featured hero + Breaking sidebar (biggest 24h movers) + Trending grid + New grid
- Updated `markets_view` exposes: `category`, `image_url`, `is_featured`, `outcome_yes_label`, `outcome_no_label`, `yes_price_24h_ago`, `volume_24h`, plus the existing `yes_price`, `volume`, `trade_count`. Volume now uses `|cost|` so sells count as activity.

### Phase 3 entry — polish
- Global `error.tsx` + `loading.tsx`
- `not-found.tsx` for missing markets
- Admin flag toggle UI (click to flip enabled/disabled — `real_money_enabled` deliberately still off)

## Phase 1 deliverables (prediction markets)

- [x] `markets`, `positions`, `trades` schema with RLS
- [x] Binary CPMM with `place_trade` atomic RPC (row-lock + ledger post + position upsert in one txn)
- [x] `create_market` RPC (subsidy locked in pool, posted through ledger)
- [x] `resolve_market` RPC (admin only — pays winners 1 VIBE / share, burns residual)
- [x] Markets list at `/markets`
- [x] Market detail at `/markets/[id]` with live YES/NO prices, recent trades, your position
- [x] Trade panel with client-side price preview (new price, avg price, max payout)
- [x] Create-market form at `/markets/new`
- [x] Admin market resolution UI in `/admin`
- [x] `markets_enabled` feature flag (on by default in dev)

### How the CPMM works

For a binary market, the AMM holds two reserves: `reserve_yes` and `reserve_no`. Invariant: `reserve_yes * reserve_no = k`. To buy `shares` of YES for `cost` VIBE:

```
shares = reserve_yes + cost - (reserve_yes * reserve_no) / (reserve_no + cost)
new_reserve_yes = reserve_yes + cost - shares
new_reserve_no  = reserve_no  + cost
```

Phase 1 is **buy-only**. Selling shares back to the AMM (and LP withdrawals) is Phase 2+. To exit a position, wait for resolution.

The math lives in two mirrored places: `supabase/migrations/20260102000000_markets.sql` (authoritative) and `src/lib/cpmm.ts` (UI preview only). Keep them in sync.

## Local setup

### 1. Install deps

```bash
npm install
```

If you hit a TLS error on Windows (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`), set:

```powershell
$env:NODE_OPTIONS="--use-system-ca"
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

You need a Supabase project. Two options:

**Cloud project (recommended for fastest start):**
1. Create a project at https://supabase.com.
2. Copy the URL and the `anon` (or `publishable`) key into `.env.local`.
3. Copy the `service_role` key into `.env.local` (server only — keep secret).
4. In the SQL editor, paste `supabase/migrations/20260101000000_init.sql` and run it.

**Local Supabase via CLI (preferred long-term):**
```bash
npx supabase start
# Then push the migration:
npx supabase db reset --local
```
Local credentials will be printed by `supabase start`.

### 3. Run

```bash
npm run dev
```

Open http://localhost:3000.

### 4. Verify the ledger works

1. Sign up at `/signup`.
2. You should land on `/` with **1,000 VIBE** showing in the header.
3. Hit `/healthz` — should return `{"status":"ok","checks":{"db":"ok"}}`.
4. Inspect in Supabase SQL editor:
   ```sql
   select * from public.user_balances where user_id = '<your-user-id>';
   select * from public.ledger_entries order by created_at desc limit 10;
   ```

## Architecture invariants

These are enforced at the database level. Don't try to work around them in app code.

1. **The ledger is append-only.** Update and delete on `ledger_transactions` and `ledger_entries` raise. If you posted bad data, post a **correcting** transaction (a debit that undoes the credit).
2. **Every transaction balances to zero per currency.** A constraint trigger checks this at commit. Posting unbalanced entries will roll back the whole transaction.
3. **Balances are derived, not stored.** `public.user_balances` is a view over `ledger_entries`. There is no cache. If you ever introduce one (Phase 3+), you must keep it consistent with the ledger.
4. **Idempotency via `external_ref`.** Every business event has a stable external key (Stripe event id, `signup_bonus:<user_id>`, etc). Repeated posts under the same ref are no-ops.
5. **RLS is on everywhere in `public`.** Users see only their own wallet, ledger entries, and transactions. Service role is the only thing that writes ledger entries.
6. **Admin role lives in `app_metadata`, not `user_metadata`.** `user_metadata` is client-editable and unsafe for authorization.

## Promoting an admin

There's no UI yet. From a Node script with the service role:

```ts
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(URL, SERVICE_ROLE_KEY);
await supabase.auth.admin.updateUserById("<user-id>", {
  app_metadata: { role: "admin" },
});
```

The change takes effect on the next token refresh (within `jwt_expiry`, default 1h).

## Posting to the ledger from server code

```ts
import { post } from "@/lib/ledger";

// Award 50 VIBE for completing a task.
await post({
  kind: "task_reward",
  externalRef: `task_reward:${userId}:${taskId}`, // stable + unique per event
  createdBy: userId,
  metadata: { taskId },
  entries: [
    {
      account: { kind: "user_wallet", userId, currency: "vibe" },
      amount: 50,
      currency: "vibe",
    },
    {
      account: { kind: "system_mint", currency: "vibe", code: "vibe_mint" },
      amount: -50,
      currency: "vibe",
    },
  ],
});
```

If called twice with the same `externalRef`, the second call is a no-op and returns `alreadyPosted: true`.

## What's next

- **Pro subscription** with monthly billing (Stripe recurring) — gates: higher market-creation limit, advanced charts, profile flair.
- **Battle Pass S1** — seasonal progression with VIBE-paid tier and Gem-paid premium tier.
- **True multi-outcome markets** — Polymarket has these for elections / tournaments. Requires a separate `market_outcomes` table and LMSR or n-CPMM pricing math. ~2 hours of focused work; a new phase.
- **Historical price chart** on the market detail page — we already store `reserve_*_after` on every trade, so the data is there; just needs a charting component.
- **Notifications** (in-app + optional email digest).
- **Anti-abuse**: rate limits on `place_trade` and comments; per-user daily VIBE earnings cap.
- **Equip-and-render skins** (currently inventory is tracked but not rendered anywhere).
- **LP positions** for market creators (currently subsidy is locked-and-burned).

## What is explicitly **not** built yet

- **No mobile app.** Web-only for now.
- **No real-money flows of any kind.** `real_money_enabled` flag must stay `false` until licensing is in place. Phase 5+ only.
- **No LP positions.** Creator's subsidy is locked in the pool and any residual at resolution burns.
- **No loot boxes.** Intentionally skipped — regulatory landmine in EU and elsewhere.
- **No peer-to-peer Gem transfers.** Closed-loop economy is the entire legal posture; don't add this without lawyers.
