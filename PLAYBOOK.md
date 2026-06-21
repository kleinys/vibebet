# Vibebet Playbook

The "factory line" for shipping each phase. Every session follows the same six-step loop. If you're unsure where you are, the **state-check query** at the bottom will tell you.

---

## The session loop

Every phase / feature follows the same shape:

| Step | Who | What |
|------|-----|------|
| **1. Plan** | Cursor agent | Agent describes what's being added in plain English, you say "go" |
| **2. Code** | Cursor agent | Agent writes migration + app code; agent runs typecheck + lint + build, hands off only when clean |
| **3. Sync** | **You** | Paste new migration(s) into Supabase SQL Editor; run state-check query to verify |
| **4. Smoke** | **You** | Run `npm run dev`, exercise the new feature manually |
| **5. Deploy** | **You** | `git push` → Vercel redeploys (once set up) |
| **6. Sign off** | You → agent | Tell agent "phase X green" — agent picks the next ticket |

If any step fails, **stop**. Paste the error to the agent before continuing. Skipping a failed step compounds the bug.

---

## How to apply a migration (every single time)

This is mechanical. Don't think — just do.

1. In Cursor, open `vibebet/supabase/migrations/<timestamp>_<name>.sql`
2. `Ctrl+A` → `Ctrl+C` (select all + copy)
3. In your browser → Supabase Dashboard → **SQL Editor** (left sidebar)
4. Click **+ New query** (top right of editor)
5. `Ctrl+V` → click **Run** (bottom right, or `Ctrl+Enter`)
6. Look at the bottom — expect **"Success. No rows returned"** (some migrations show row counts; that's fine too)
7. **If error**: stop. Don't run the next one. Paste the full error text to the agent.
8. Repeat for the next migration in order

After all migrations for the session are applied, **always** run the state-check query (bottom of this file) to confirm you're in the expected state.

### Postgres gotcha: enum value adds need a separate transaction

When a migration adds a new value to an existing enum (`ALTER TYPE ... ADD VALUE 'foo'`), that value **cannot be used in the same transaction**. The Supabase SQL Editor runs each script as one transaction, so we always split such migrations into two files:

- `<timestamp>0_<name>_enums.sql` — only the `ALTER TYPE ... ADD VALUE` lines. Tiny.
- `<timestamp>1_<name>.sql` — everything else.

Run them as two separate executions: paste & Run the enums file, then paste & Run the main file. If you see `ERROR: 55P04: unsafe use of new value …`, this is what happened — re-run as two scripts.

---

## Migration ledger

Each row is one migration file. Order matters — apply in the order shown. Do NOT skip or re-order.

| # | File | Phase | Adds | Verification snippet (`information_schema`) |
|---|------|-------|------|---------------------------------------------|
| 1 | `20260101000000_init.sql` | 0 | Profiles, double-entry ledger, wallets, 1000 VIBE signup bonus, feature flags, admin role check | `table_name='profiles'` |
| 2 | `20260102000000_markets.sql` | 1 | Markets, positions, trades, CPMM `place_trade` + `create_market` + `resolve_market` RPCs | `table_name='markets'` |
| 3 | `20260103000000_sell_shares.sql` | 1.1 | `sell_shares` RPC, `positions.total_proceeds` column | `column_name='total_proceeds'` |
| 4 | `20260104000000_shop_and_gems.sql` | 1.5 | `shop_items`, `gem_bundles`, `user_inventory`, `spend_gems_for_item` RPC | `table_name='shop_items'` |
| 5 | `20260105000000_social.sql` | 2 | `market_comments` table, `leaderboard()` RPC | `table_name='market_comments'` |
| 6 | `20260106000000_categories_and_metrics.sql` | 2.5 | Categories, custom Yes/No labels, `is_featured`, `image_url`, enhanced `markets_view` with 24h stats | `column_name='category'` (on `markets`) |
| 7 | `20260107000000_notifications.sql` | 2.7 | `notifications` table, `event_queue` table, `notification_kind` enum, `mark_notifications_read` + `unread_notification_count` + `process_event_queue` RPCs, AFTER-INSERT trigger on `market_comments`, patched `resolve_market` to enqueue + drain | `table_name='notifications'` |
| 8a | `20260108000000_meme_court_enums.sql` | 3 | Adds new enum values: `market_status += 'resolving', 'in_court'`; `notification_kind += 'resolution_proposed', 'dispute_opened', 'dispute_resolved'`. **Run this BEFORE 8b** — Postgres won't let you use a brand-new enum value in the same transaction it was added (error 55P04). | `SELECT 1 FROM pg_enum WHERE enumlabel='resolving'` |
| 8b | `20260108000001_meme_court.sql` | 3 | `disputes` + `court_votes` tables, `dispute_status` enum, `markets.proposed_outcome` + `challenge_deadline` + `voting_ends_at` cols, RPCs: `propose_resolution`, `finalize_market_internal`, `open_dispute`, `cast_vote`, `resolve_dispute_internal`, `court_tick`. Extends `process_event_queue` with court events. Recreates `markets_view`. | `table_name='disputes'` |
| 9a | `20260109000000_categorical_enums.sql` | 4 | Creates the `market_kind` enum (`'binary' \| 'categorical'`). Tiny / idempotent. Same "enums first" pattern even though `CREATE TYPE` wouldn't strictly need splitting — keeps the migration habit consistent. | `SELECT 1 FROM pg_type WHERE typname='market_kind'` |
| 9b | `20260109000001_categorical_markets.sql` | 4 | `market_outcomes` + `categorical_positions` tables; `markets.kind` + `markets.lmsr_b` + `markets.proposed_outcome_index` cols; `trades.outcome_index` col (side made nullable); LMSR math helpers (`log_sum_exp`, `lmsr_prices`, `lmsr_shares_for_cost`); RPCs: `create_categorical_market`, `place_categorical_trade`, `propose_resolution_categorical`, `finalize_categorical_internal`; patches `court_tick`, `open_dispute`, `process_event_queue` for categorical; rebuilds `markets_view`; adds `categorical_market_view`. | `table_name='market_outcomes'` |

---

## Phase ledger

| Phase | What it is | Code | Migration | Cloud-applied? |
|---|---|---|---|---|
| 0 | Foundation: auth, ledger, wallets, RLS, feature flags | ✅ | 1 | ✅ |
| 1 | CPMM prediction markets | ✅ | 2 | ✅ |
| 1.1 | Sell shares back to the AMM | ✅ | 3 | ⏳ pending |
| 1.5 | Shop, Gems, Stripe Checkout | ✅ | 4 | ⏳ pending |
| 2 | Comments + leaderboard + account | ✅ | 5 | ⏳ pending |
| 2.5 | Polymarket-style discovery (categories, search, custom labels, featured) | ✅ | 6 | ✅ |
| 2.7 | Price chart + notifications | ✅ | 7 | ✅ |
| 3 | Meme Court (disputes + community vote) | ✅ | 8 | ✅ |
| 3.5 | Polish: account section nav, /account/disputes, /account/votes, /account/profile editor, status filters on /markets and /court | ✅ | _none — UI only_ | — |
| 4 | Multi-outcome (categorical) markets | ✅ | 9 | ⏳ pending |
| 4.5–4.7 | Official markets, Polymarket mirror, platform bots | ✅ | 10–14 | ⏳ pending |
| 5 | Ranks, streaks, achievements | ✅ | 16 | ⏳ pending |
| 6 | Pro subscription | 🚫 hold (post-PMF) | — | — |
| 7 | HustleOS (tasks, skill trees, tools, arsenal) | 🚫 hold (separate product) | — | — |
| 8 | KYC, geoblocking, real-money | 🚫 hold (legal review required) | — | — |

Update this table whenever a phase ships or its status changes.

---

## State-check query

**Paste this into SQL Editor any time** to see exactly which migrations are applied. Each column returns `1` if the migration that adds that feature has been applied, `0` if not.

```sql
select
  (select count(*) from information_schema.tables
     where table_schema='public' and table_name='profiles')           as m1_init,
  (select count(*) from information_schema.tables
     where table_schema='public' and table_name='markets')            as m2_markets,
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='positions'
       and column_name='total_proceeds')                              as m3_sell,
  (select count(*) from information_schema.tables
     where table_schema='public' and table_name='shop_items')         as m4_shop,
  (select count(*) from information_schema.tables
     where table_schema='public' and table_name='market_comments')    as m5_social,
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='markets'
       and column_name='category')                                    as m6_categories,
  (select count(*) from information_schema.tables
     where table_schema='public' and table_name='notifications')      as m7_notifications,
  (select count(*) from information_schema.tables
     where table_schema='public' and table_name='disputes')           as m8_court;
```

**Healthy state at end of session 5:** all eight columns return `1`.

---

## Cloud setup checks (one-time, in Supabase Dashboard)

These aren't migrations but configuration. Verify once, then forget about them.

| Setting | Where | Value | Status |
|---|---|---|---|
| "Confirm email" | Auth → Sign In / Providers | **OFF** | ⏳ pending |
| Your `app_metadata.role` | `auth.users` table | `"admin"` | ⏳ pending |
| Stripe webhook signing secret | `.env.local` `STRIPE_WEBHOOK_SECRET` | filled (optional until you test Gem purchases) | optional |

### Promote yourself to admin

In SQL Editor (replace email):

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'YOUR-EMAIL-HERE@example.com'
returning id, email, raw_app_meta_data;
```

Then sign out + sign back in for the JWT to refresh.

---

## Smoke test (after every sync)

Boot the app: `npm run dev` → open <http://localhost:3000>. The following should ALL work end-to-end. If any step fails, paste the error to the agent.

1. **Sign up** a fresh account → land in app → header shows `1,000 VIBE`.
2. **Create a market** at `/markets/new` — pick category Crypto, labels Above/Below, subsidy 500 → balance now ~500 VIBE.
3. **Place a bet** of 100 VIBE on Above → trade panel shows price-impact preview → bet succeeds → balance now ~400 VIBE → price moves toward Above.
4. **Sell half** your shares back → you receive less than you paid (correct — AMM curve + your own price impact).
5. **Comment** on the market → comment appears under "Discussion".
6. **Home page** (`/`) — your market appears in "Trending now" with the Crypto icon and Above/Below labels.
7. **Category filter** — click "Crypto" tab on `/markets` → only crypto markets.
8. **Search** in header — type "bitcoin" → only matching markets.
9. **Admin** at `/admin` — feature flags toggle works; resolve buttons show "Resolve Above" / "Resolve Below" (your custom labels).
10. **Resolve** your market as Above → go to `/account` → see the payout in your position row.

When all 10 pass, the session is green.

---

## Deploy to Vercel (one-time setup, then automatic)

Recommended right after the smoke test passes for the first time. Future deploys are `git push` and done.

1. Push the repo to GitHub if not already:
   ```bash
   cd C:\Users\Šarūnas\marketing\vibebet
   git init   # if needed
   git add .
   git commit -m "vibebet phase 2.5 — polymarket-style discovery"
   gh repo create vibebet --private --source=. --push   # or use the GitHub web UI
   ```
2. Go to <https://vercel.com> → **Add New** → **Project** → import the `vibebet` repo
3. In the project's **Settings → Environment Variables**, paste every line from your `.env.local` (one per row). For the *production* environment, use **live** Stripe keys if you've set them up; otherwise leave Stripe vars empty (the app's env validator already preprocesses empty strings to `undefined`).
4. Click **Deploy**. You get a `vibebet-xxx.vercel.app` URL.
5. In Supabase Dashboard → **Authentication → URL Configuration**, add your Vercel URL to **Site URL** and **Redirect URLs** so OAuth callbacks work.

After that, every `git push` to `main` triggers a redeploy. Migrations still need to be applied manually to the cloud DB (see "How to apply a migration" above), since we don't yet use the Supabase CLI to push.

---

## Optional: Supabase CLI workflow (faster, after first deploy)

Once you have ~5 migrations applied, the copy-paste workflow gets tedious. The CLI fixes that.

```bash
cd C:\Users\Šarūnas\marketing\vibebet
npx supabase login                           # opens browser
npx supabase link --project-ref <ref>        # ref is in your project URL: <ref>.supabase.co
npx supabase db push                         # applies all unapplied migrations
```

After `link`, all future migration syncs are one command. The state-check query becomes a sanity check, not a required step.

You don't have to set this up today — copy-paste is fine for now. Switch when you're tired of pasting.

---

## How to use this playbook for THIS session

You are about to ship Phase 2.7 (price chart + notifications). The agent will write the code. You will:

1. ✅ Apply migrations 3, 4, 5, 6 — open each file from the ledger, paste, Run
2. ✅ Run the state-check query — expect all sixes to be `1`
3. ✅ Toggle "Confirm email" OFF in Supabase Auth settings
4. ✅ Promote yourself to admin (SQL above)
5. ✅ Run smoke test steps 1-10
6. ✅ Say "phase 2.5 green" to the agent — agent starts coding Phase 2.7

When 2.7's code lands:
1. Apply migration 7 → state-check (expect a 7th `1`)
2. Smoke-test the chart + notifications
3. `git push` → Vercel deploys automatically
4. Say "phase 2.7 green" to start Phase 3 (Meme Court)

When Phase 3 (Meme Court) lands:
1. Apply migration 8 → state-check (expect an 8th `1`, `m8_court`)
2. Smoke-test (steps below)
3. Say "phase 3 green" to start the next phase.

### Phase 3 smoke test (Meme Court)

You need **three accounts** to exercise the full flow: an **admin**, a **trader** (will dispute), and a **voter** (will cast a court vote — must not have traded the market). Open them in three browsers / profiles.

1. As admin → `/markets/new` → create a market.
2. As trader → buy a small amount of shares on the WRONG side (the side you'll later challenge — say you buy NO when you actually believe YES will win).
3. As admin → `/admin` → click **Propose YES** (the side the trader bet *against*). Market status flips to `challenge`.
4. As trader → open the market → see the amber **Resolution proposed** banner with a 24h countdown → click **Dispute outcome** → file reasoning → submit. Stake is debited from VIBE balance. You're redirected to `/court/<disputeId>`.
5. As voter → `/court` → see the active case → open it → cast **Overturn** (agreeing with the trader). One vote per user; final.
6. (Optional) As a 4th unrelated account → also vote.
7. To finalize without waiting 48h, run in SQL Editor: `update public.disputes set voting_ends_at = now() - interval '1 minute' where status = 'voting';` then reload `/court/<disputeId>` — the next page load calls `court_tick` which resolves the dispute and finalizes the market.
8. Verify: trader's wallet should show stake refunded (since overturn won) + payout from the new outcome. Notifications bell should show `dispute_resolved`.

When all 8 pass, Phase 3 is green.
