import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { listPlatformModules, getMyInstalledModules } from "@/lib/platform-modules";
import { PlatformModuleCard } from "@/components/platform-module-card";
import { FeatureOffPanel } from "@/components/feature-off-panel";

export const revalidate = 0;

export default async function AppsBrowsePage() {
  const modulesOn = await isEnabled("user_modules_enabled");
  if (!modulesOn) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <FeatureOffPanel
          title="Platform Apps"
          body="The extension store is rolling out soon."
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

  const [modules, installed] = await Promise.all([
    listPlatformModules(),
    user ? getMyInstalledModules() : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8">
        <p className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-300/90">
          Platform Apps
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Extend your Vibebet</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Install curated modules that deep-link into Play, Hustle, Markets, and Watch.
          Each install adds stone to your Legacy Cathedral.
        </p>
        {!user && (
          <p className="mt-3 text-xs text-amber-300/90">
            <Link href="/login?next=/apps" className="underline hover:text-amber-200">
              Sign in
            </Link>{" "}
            to install modules and track your library.
          </p>
        )}
      </header>

      {installed.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Your library
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {installed.map((m) => (
              <li key={m.slug}>
                <Link
                  href={m.target_href}
                  className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs text-violet-200 hover:bg-violet-500/20"
                >
                  <span>{m.icon_emoji}</span>
                  {m.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Browse
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <PlatformModuleCard key={m.slug} module={m} />
          ))}
        </div>
      </section>

      <section className="mt-10 rounded-xl border border-white/5 bg-zinc-900/30 p-5">
        <h2 className="text-sm font-semibold text-zinc-200">Build your own</h2>
        <p className="mt-1 text-xs text-zinc-500">
          User-submitted modules and royalties are coming in a future update. For now,
          install platform-curated packs above.
        </p>
      </section>
    </div>
  );
}
