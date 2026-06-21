import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import {
  getCopyableTrades,
  getCopyTraderLeaderboard,
  getMyFollowing,
} from "@/lib/copy-trading";
import { CopyTradingBoard } from "./copy-board";

export const revalidate = 0;

export default async function CopyTradingPage() {
  const enabled = await isEnabled("copy_trading_enabled");
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Copy trading off</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Enable <code className="font-mono">copy_trading_enabled</code> in Admin.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/copy");

  const [following, trades, leaders] = await Promise.all([
    getMyFollowing(),
    getCopyableTrades(25),
    getCopyTraderLeaderboard(15),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/guide" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Playbook
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Copy Trading</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Follow sharp predictors and mirror their bets — manually or with auto-copy
        up to your max stake.
      </p>

      <CopyTradingBoard
        following={following}
        trades={trades}
        leaders={leaders}
        userId={user.id}
      />
    </div>
  );
}
