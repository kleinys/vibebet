import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { listMarketSuggestions } from "@/lib/creator-hub";
import { CATEGORY_LABELS } from "@/lib/supabase/types";
import { SuggestMarketForm, SuggestionList } from "./suggest-form";

export default async function SuggestMarketPage() {
  const enabled = await isEnabled("market_suggestions_enabled");
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Suggestions off</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Enable <code className="font-mono">market_suggestions_enabled</code> in{" "}
          <Link href="/admin" className="text-fuchsia-400 hover:underline">
            Admin
          </Link>
          .
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const suggestions = await listMarketSuggestions({ status: "open", limit: 40 });

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/markets/new" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Create your own market
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Suggest a market</h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        Propose UFC fights, streamer drama, politics, anything. Community
        upvotes surface ideas; admins can launch approved suggestions with a
        platform subsidy — and you get creator credit if it goes live.
      </p>

      {user ? (
        <SuggestMarketForm />
      ) : (
        <p className="mt-6 text-sm text-zinc-400">
          <Link href="/login?next=/markets/suggest" className="text-violet-400 hover:underline">
            Sign in
          </Link>{" "}
          to submit a suggestion.
        </p>
      )}

      <section className="mt-12">
        <h2 className="text-sm font-semibold text-zinc-200">
          Top suggestions ({suggestions.length})
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Sorted by upvotes. Categories:{" "}
          {Object.values(CATEGORY_LABELS).slice(0, 4).join(", ")}, and more.
        </p>
        <SuggestionList suggestions={suggestions} />
      </section>

      <p className="mt-10 text-center text-xs text-zinc-500">
        Want recurring crypto windows with your own fee?{" "}
        <Link href="/markets/new/recurring" className="text-violet-400 hover:underline">
          Start a series →
        </Link>
      </p>
    </div>
  );
}
