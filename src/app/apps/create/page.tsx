import Link from "next/link";
import { redirect } from "next/navigation";
import { isEnabled } from "@/lib/feature-flags";
import { createClient } from "@/lib/supabase/server";
import { ModuleProposalForm } from "@/components/module-proposal-form";
import { FeatureOffPanel } from "@/components/feature-off-panel";

export const revalidate = 0;

export default async function AppsCreatePage() {
  const [modulesOn, proposalsOn] = await Promise.all([
    isEnabled("user_modules_enabled"),
    isEnabled("module_proposals_enabled"),
  ]);

  if (!modulesOn || !proposalsOn) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <FeatureOffPanel
          title="Module proposals"
          body="Creator submissions are rolling out soon."
          ctaHref="/apps"
          ctaLabel="Browse Apps"
        />
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/apps/create");

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <Link href="/apps" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Apps
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Propose a module</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Submit an idea for the Platform Apps store. Approved proposals become installable
        modules and add a wing to your Legacy Cathedral.
      </p>
      <div className="mt-8">
        <ModuleProposalForm />
      </div>
    </div>
  );
}
