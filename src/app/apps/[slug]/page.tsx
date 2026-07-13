import Link from "next/link";
import { notFound } from "next/navigation";
import { isEnabled } from "@/lib/feature-flags";
import { getPlatformModule } from "@/lib/platform-modules";
import { PlatformModuleInstallButton } from "@/components/platform-module-install-button";

export const revalidate = 0;

const KIND_LABEL: Record<string, string> = {
  duel: "Duel extension",
  hustle: "Hustle extension",
  market: "Market extension",
  arcade: "Arcade extension",
  watch: "Watch extension",
};

export default async function AppModulePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!(await isEnabled("user_modules_enabled"))) notFound();

  const module = await getPlatformModule(slug);
  if (!module) notFound();

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/apps" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Apps
      </Link>
      <div className="mt-6 flex items-start gap-4">
        <span className="text-4xl" aria-hidden>
          {module.icon_emoji}
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            {KIND_LABEL[module.kind] ?? "Module"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{module.name}</h1>
          <p className="mt-1 text-xs text-zinc-500">
            {module.install_count.toLocaleString()} installs
          </p>
        </div>
      </div>
      <p className="mt-6 text-sm leading-relaxed text-zinc-300">{module.description}</p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <PlatformModuleInstallButton
          slug={module.slug}
          installed={module.installed}
          targetHref={module.target_href}
        />
        {module.installed && (
          <p className="text-xs text-zinc-500">
            Installed modules appear in your library and cathedral.
          </p>
        )}
      </div>
    </div>
  );
}
