import Link from "next/link";
import { CommentBox } from "@/components/comment-box";
import { CategoricalTradePanel } from "@/components/categorical-trade-panel";
import { CategoricalPriceChart } from "@/components/categorical-price-chart";
import { CategoricalDisputeForm } from "@/components/categorical-dispute-form";
import { getBalance } from "@/lib/ledger";
import { getComments, getCreatorName } from "@/lib/markets";
import {
  getCategoricalMarket,
  getCategoricalPosition,
  getCategoricalPriceHistory,
  type CategoricalMarket,
} from "@/lib/categorical";
import { getDisputeForMarket, maybeTickCourt, timeRemaining } from "@/lib/court";
import { formatOutcomeProbability } from "@/lib/lmsr";
import { formatVibe } from "@/lib/utils";
import { CATEGORY_LABELS } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/server";

export async function CategoricalMarketDetail({ id }: { id: string }) {
  await maybeTickCourt();

  const market = await getCategoricalMarket(id);
  if (!market) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [creator, vibeBalance, comments, positions, priceHistory, dispute] =
    await Promise.all([
    getCreatorName(market.creator_id),
    user ? getBalance(user.id, "vibe") : Promise.resolve(0),
    getComments(market.id, 50),
    user ? getCategoricalPosition(market.id, user.id) : Promise.resolve(new Map()),
    getCategoricalPriceHistory(
      market.id,
      market.outcomes.length,
      market.lmsr_b,
    ),
    market.status === "resolving" || market.status === "in_court"
      ? getDisputeForMarket(market.id)
      : Promise.resolve(null),
  ]);

  const closed =
    market.status !== "open" ||
    (market.closes_at !== null && new Date(market.closes_at) <= new Date());

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link
        href="/markets"
        className="text-xs text-zinc-500 hover:text-zinc-300"
      >
        ← All markets
      </Link>

      <header className="mt-3">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500">
          <span className="rounded bg-violet-500/10 px-2 py-0.5 text-violet-300 ring-1 ring-violet-500/30">
            Multi-outcome
          </span>
          <span>{CATEGORY_LABELS[market.category]}</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold leading-snug">
          {market.question}
        </h1>
        <p className="mt-2 text-xs text-zinc-500">
          Created by {creator}
          {market.closes_at && (
            <> · Closes {new Date(market.closes_at).toLocaleString()}</>
          )}
        </p>
      </header>

      {market.description && (
        <p className="mt-4 whitespace-pre-wrap rounded-lg border border-white/5 bg-zinc-900/40 p-4 text-sm text-zinc-300">
          {market.description}
        </p>
      )}

      {market.status === "resolving" && market.challenge_deadline && (
        <div className="mt-4 rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
          <h2 className="text-sm font-semibold text-violet-200">
            Resolution proposed:{" "}
            {market.outcomes.find(
              (o) => o.outcome_index === market.proposed_outcome_index,
            )?.label ?? "Unknown outcome"}
          </h2>
          <p className="mt-1 text-xs text-violet-200/80">
            Challenge window closes in{" "}
            <span className="font-medium">
              {timeRemaining(market.challenge_deadline)}
            </span>
            . Hold shares? Open a dispute to trigger a resolution poll.
          </p>
          {user && positions.size > 0 && !dispute && (
            <CategoricalDisputeForm
              marketId={market.id}
              estimatedStake={Math.max(100, Math.min(10000, Math.floor(market.volume / 20)))}
              proposedIndex={market.proposed_outcome_index ?? 0}
              outcomes={market.outcomes}
            />
          )}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <OutcomeGrid market={market} />

          <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Price history
            </h2>
            <div className="mt-3">
              <CategoricalPriceChart
                points={priceHistory}
                labels={market.outcomes.map((o) => o.label)}
              />
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Market stats
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <Stat label="Volume" value={`${formatVibe(market.volume)} VIBE`} />
              <Stat label="Trades" value={market.trade_count.toString()} />
              <Stat label="Outcomes" value={market.outcomes.length.toString()} />
            </dl>
          </div>

          {positions.size > 0 && (
            <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Your positions
              </h2>
              <ul className="mt-3 space-y-2 text-sm">
                {market.outcomes.map((o) => {
                  const pos = positions.get(o.outcome_index);
                  if (!pos || pos.shares <= 0) return null;
                  return (
                    <li
                      key={o.outcome_index}
                      className="flex justify-between text-zinc-300"
                    >
                      <span>{o.label}</span>
                      <span>
                        {formatVibe(pos.shares)} shares · spent{" "}
                        {formatVibe(pos.totalCost)} VIBE
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <DiscussionBlock marketId={market.id} user={user?.id ?? null} comments={comments} />
        </section>

        <aside>
          {user ? (
            <CategoricalTradePanel
              marketId={market.id}
              outcomes={market.outcomes}
              lmsrB={market.lmsr_b}
              disabled={closed}
              vibeBalance={vibeBalance}
            />
          ) : (
            <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4 text-sm text-zinc-400">
              <Link
                href={`/login?next=/markets/${market.id}`}
                className="text-fuchsia-400 hover:underline"
              >
                Sign in
              </Link>{" "}
              to trade this market.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function OutcomeGrid({ market }: { market: CategoricalMarket }) {
  return (
    <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Outcomes
      </h2>
      <ul className="mt-3 space-y-2">
        {market.outcomes.map((o) => (
          <li
            key={o.outcome_index}
            className="flex items-center justify-between rounded-lg bg-zinc-950/60 px-4 py-3"
          >
            <span className="font-medium text-zinc-100">{o.label}</span>
            <span className="text-lg font-semibold tabular-nums text-violet-300">
              {formatOutcomeProbability(o.probability)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-zinc-500">
        {label}
      </dt>
      <dd className="mt-0.5 font-medium text-zinc-200">{value}</dd>
    </div>
  );
}

function DiscussionBlock({
  marketId,
  user,
  comments,
}: {
  marketId: string;
  user: string | null;
  comments: Awaited<ReturnType<typeof getComments>>;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Discussion
      </h2>
      {user ? (
        <div className="mt-3">
          <CommentBox marketId={marketId} />
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">
          <Link
            href={`/login?next=/markets/${marketId}`}
            className="text-fuchsia-400 hover:underline"
          >
            Sign in
          </Link>{" "}
          to join the conversation.
        </p>
      )}
      {comments.length > 0 && (
        <ul className="mt-4 space-y-3 border-t border-white/5 pt-4">
          {comments.map((c) => (
            <li key={c.id} className="text-sm">
              <span className="font-medium text-zinc-300">{c.display_name}</span>
              <span className="mx-2 text-zinc-600">·</span>
              <span className="text-zinc-400">{c.body}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
