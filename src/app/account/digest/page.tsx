import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { AccountNav } from "@/components/account-nav";
import { DigestToggle } from "@/components/digest-toggle";
import { formatVibe } from "@/lib/utils";

export const revalidate = 0;

export default async function DigestPage() {
  const enabled = await isEnabled("weekly_digest_enabled");
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Weekly digest off</h1>
        <p className="mt-2 text-sm text-zinc-400">
          The flag <code className="font-mono">weekly_digest_enabled</code> is off or
          missing from your database.
        </p>
        <p className="mt-3 text-xs text-zinc-500">
          In Admin → Feature flags, click{" "}
          <strong className="text-zinc-300">Sync missing flags</strong>, then enable{" "}
          <code className="font-mono">weekly_digest_enabled</code>.
          If you used &quot;enable all&quot; before syncing, that flag was never in the
          list to toggle.
        </p>
        <Link
          href="/admin"
          className="mt-6 inline-block text-sm text-fuchsia-400 hover:underline"
        >
          Open Admin →
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/digest");

  const { getWeeklyDigest } = await import("@/lib/weekly-digest");
  const digest = await getWeeklyDigest();

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Account</h1>
      <AccountNav active="/account/digest" />

      <header className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Weekly recap
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Week of {digest?.week_label ?? "this week"}
        </p>
      </header>

      {digest ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <DigestStat label="Bets placed" value={String(digest.trades_count)} />
          <DigestStat label="Volume" value={formatVibe(digest.volume)} />
          <DigestStat label="Wins" value={String(digest.wins)} />
          <DigestStat label="Losses" value={String(digest.losses)} />
          <DigestStat
            label="VIBE in (est.)"
            value={formatVibe(digest.profit_estimate)}
          />
        </div>
      ) : (
        <p className="mt-6 text-sm text-zinc-500">No activity this week yet.</p>
      )}

      {digest?.top_market && (
        <p className="mt-6 text-sm text-zinc-400">
          Most wagered market:{" "}
          <span className="text-zinc-200">{digest.top_market}</span>
        </p>
      )}

      <DigestToggle enabled={digest?.email_digest_enabled ?? true} />

      <p className="mt-6 text-xs text-zinc-500">
        In-app digest is live. Actual email delivery will plug in when an email
        provider (e.g. Resend) is configured.
      </p>

      <p className="mt-4 text-center text-xs">
        <Link href="/invite" className="text-fuchsia-400 hover:underline">
          Invite friends →
        </Link>
      </p>
    </div>
  );
}

function DigestStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-zinc-900/40 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
