import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import {
  playerCodeHint,
  referralRewardsBlurb,
  REFERRAL_TOTAL_VIBE_PER_FRIEND,
  REFERRAL_REWARDS,
} from "@/lib/referral-copy";

export async function PlayerCodeCard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const referralsOn = await isEnabled("referrals_enabled");
  const { data } = await supabase.rpc("get_my_player_code");
  const row = Array.isArray(data) ? data[0] : null;
  if (!row?.referral_code) return null;

  return (
    <section className="rounded-xl border border-violet-500/25 bg-gradient-to-br from-violet-950/50 to-[#020617] p-4 ring-1 ring-violet-500/20">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-violet-300">
        Your player code
      </h2>
      <p className="mt-2 font-mono text-xl tracking-wide text-violet-100">
        {row.referral_code}
      </p>
      {row.username && (
        <p className="mt-1 text-xs text-zinc-500">
          Or challenge by username:{" "}
          <span className="text-zinc-300">@{row.username}</span>
        </p>
      )}
      <p className="mt-3 text-xs leading-relaxed text-zinc-400">
        {playerCodeHint(referralsOn)}
      </p>
      {referralsOn && (
        <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-zinc-300">
          <p className="font-medium text-amber-200">Invite rewards (VIBE)</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-400">
            <li>
              <span className="text-amber-200">{REFERRAL_REWARDS.signupVibe} VIBE</span>{" "}
              when a friend signs up with your code
            </li>
            <li>
              <span className="text-amber-200">{REFERRAL_REWARDS.firstBetVibe} VIBE</span>{" "}
              when they place their first bet
            </li>
            <li>
              Up to{" "}
              <span className="text-amber-200">{REFERRAL_TOTAL_VIBE_PER_FRIEND} VIBE</span>{" "}
              per active friend — play-money only, not USD
            </li>
          </ul>
          <p className="mt-2 text-[10px] text-zinc-500">
            {referralRewardsBlurb()}
          </p>
        </div>
      )}
      <Link
        href="/invite"
        className="mt-4 inline-block text-xs font-medium text-fuchsia-400 hover:underline"
      >
        Open invite page → copy link &amp; track rewards
      </Link>
    </section>
  );
}
