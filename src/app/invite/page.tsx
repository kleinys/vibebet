import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { getMyReferralStats } from "@/lib/referrals";
import { clientEnv } from "@/lib/env";
import { formatVibe } from "@/lib/utils";
import { ReferralApplyForm } from "@/components/referral-apply-form";

export const revalidate = 0;

export default async function InvitePage() {
  const enabled = await isEnabled("referrals_enabled");
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Referrals off</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Enable <code className="font-mono">referrals_enabled</code> in Admin.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/invite");

  const stats = await getMyReferralStats();
  const siteUrl = clientEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const inviteLink = stats?.referral_code
    ? `${siteUrl}/signup?ref=${stats.referral_code}`
    : null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/account" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Account
      </Link>

      <h1 className="mt-3 text-2xl font-semibold">Invite friends</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Share your link. You earn{" "}
        <span className="text-amber-200">100 VIBE</span> when they sign up and{" "}
        <span className="text-amber-200">250 VIBE</span> when they place their
        first bet.
      </p>

      {inviteLink && (
        <div className="mt-6 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-5">
          <p className="text-xs uppercase tracking-wider text-emerald-300">
            Your invite link
          </p>
          <p className="mt-2 break-all font-mono text-sm text-zinc-200">
            {inviteLink}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Code: <span className="font-mono text-zinc-300">{stats?.referral_code}</span>
          </p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
        <Stat label="Friends invited" value={String(stats?.invite_count ?? 0)} />
        <Stat
          label="VIBE earned"
          value={formatVibe(stats?.total_vibe_earned ?? 0)}
        />
      </div>

      {!stats?.referred_by && (
        <ReferralApplyForm className="mt-8" />
      )}

      {(stats?.recent_invites.length ?? 0) > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Recent invites
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {stats?.recent_invites.map((inv) => (
              <li
                key={inv.joined_at + inv.display_name}
                className="flex justify-between rounded-lg border border-white/5 px-3 py-2"
              >
                <span>{inv.display_name}</span>
                <span className="text-xs text-zinc-500">
                  {new Date(inv.joined_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-zinc-900/40 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
