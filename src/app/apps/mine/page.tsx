import Link from "next/link";
import { redirect } from "next/navigation";
import { isEnabled } from "@/lib/feature-flags";
import { createClient } from "@/lib/supabase/server";
import { getMyCreatorHub } from "@/lib/creator-hub";
import { getMyInstalledModules } from "@/lib/platform-modules";
import { FeatureOffPanel } from "@/components/feature-off-panel";

export const revalidate = 0;

export default async function AppsMinePage() {
  if (!(await isEnabled("user_modules_enabled"))) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <FeatureOffPanel
          title="Creator hub"
          body="Apps are not enabled yet."
          ctaHref="/play"
          ctaLabel="Back to Play"
        />
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/apps/mine");

  const [hub, installed] = await Promise.all([
    getMyCreatorHub(),
    getMyInstalledModules(),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/apps" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Apps
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Creator hub</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Your installs, proposals, and cathedral progress.
      </p>

      <dl className="mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-white/10 bg-zinc-900/40 p-3 text-center">
          <dt className="text-[10px] uppercase text-zinc-500">Installed</dt>
          <dd className="mt-1 text-xl font-semibold text-violet-200">
            {hub?.install_count ?? 0}
          </dd>
        </div>
        <div className="rounded-lg border border-white/10 bg-zinc-900/40 p-3 text-center">
          <dt className="text-[10px] uppercase text-zinc-500">Pending</dt>
          <dd className="mt-1 text-xl font-semibold text-amber-200">
            {hub?.pending_proposals ?? 0}
          </dd>
        </div>
        <div className="rounded-lg border border-white/10 bg-zinc-900/40 p-3 text-center">
          <dt className="text-[10px] uppercase text-zinc-500">Approved</dt>
          <dd className="mt-1 text-xl font-semibold text-emerald-200">
            {hub?.approved_proposals ?? 0}
          </dd>
        </div>
      </dl>

      {installed.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Your library
          </h2>
          <ul className="mt-3 space-y-2">
            {installed.map((m) => (
              <li key={m.slug}>
                <Link
                  href={m.target_href}
                  className="flex items-center gap-2 rounded-lg border border-white/8 bg-zinc-900/30 px-3 py-2 text-sm hover:border-violet-500/30"
                >
                  <span>{m.icon_emoji}</span>
                  {m.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Your proposals
        </h2>
        {hub && hub.submissions.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {hub.submissions.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-white/8 bg-zinc-900/30 px-3 py-2 text-sm"
              >
                <span>
                  {s.name}{" "}
                  <span className="text-[10px] text-zinc-500">({s.kind})</span>
                </span>
                <span
                  className={`text-[10px] font-bold uppercase ${
                    s.status === "approved"
                      ? "text-emerald-400"
                      : s.status === "rejected"
                        ? "text-rose-400"
                        : "text-amber-400"
                  }`}
                >
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">No proposals yet.</p>
        )}
        <Link
          href="/apps/create"
          className="mt-4 inline-block text-sm text-fuchsia-400 hover:underline"
        >
          Propose a module →
        </Link>
      </section>
    </div>
  );
}
