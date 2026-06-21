import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { getOnboardingState } from "@/lib/onboarding";

export async function GettingStartedBar({
  mobileNavOn,
}: {
  mobileNavOn: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [wizardOn, duelsOn, guildsOn, copyOn, onboarding] = await Promise.all([
    isEnabled("onboarding_wizard_enabled"),
    isEnabled("duels_enabled"),
    isEnabled("guilds_enabled"),
    isEnabled("copy_trading_enabled"),
    user ? getOnboardingState() : Promise.resolve(null),
  ]);

  const showWizard =
    wizardOn &&
    user &&
    onboarding &&
    !onboarding.completed &&
    !onboarding.skipped;

  const showPlaybook = !mobileNavOn;
  const showSecondaryLinks = !mobileNavOn && user;

  if (mobileNavOn && user && !showWizard) {
    return null;
  }

  return (
    <div className="border-t border-fuchsia-500/15 bg-gradient-to-r from-fuchsia-950/90 via-zinc-950 to-violet-950/90">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-2 px-4 py-3 text-sm">
        {!user && (
          <>
            <span className="text-zinc-400">New here?</span>
            {showPlaybook && (
              <Link
                href="/guide"
                className="rounded-full bg-fuchsia-500 px-3.5 py-1 font-medium text-white shadow-sm shadow-fuchsia-500/30 hover:bg-fuchsia-400"
              >
                Read the Playbook
              </Link>
            )}
            <Link
              href="/signup"
              className="text-fuchsia-300/90 hover:text-white hover:underline"
            >
              Sign up for 1,000 VIBE →
            </Link>
          </>
        )}

        {user && showPlaybook && (
          <>
            <span className="text-zinc-400">New here?</span>
            <Link
              href="/guide"
              className="rounded-full bg-fuchsia-500 px-3.5 py-1 font-medium text-white shadow-sm shadow-fuchsia-500/30 hover:bg-fuchsia-400"
            >
              Read the Playbook
            </Link>
          </>
        )}

        {showWizard && (
          <Link
            href="/onboarding"
            className="rounded-full border border-violet-400/40 bg-violet-500/10 px-3.5 py-1 font-medium text-violet-200 hover:bg-violet-500/20"
          >
            Finish setup — step {(onboarding?.step ?? 0) + 1}/5
          </Link>
        )}

        {showSecondaryLinks && duelsOn && (
          <Link href="/duels" className="text-zinc-400 hover:text-zinc-200">
            Duels →
          </Link>
        )}
        {showSecondaryLinks && guildsOn && (
          <Link href="/guilds" className="text-zinc-400 hover:text-zinc-200">
            Guilds →
          </Link>
        )}
        {showSecondaryLinks && copyOn && (
          <Link href="/copy" className="text-zinc-400 hover:text-zinc-200">
            Copy trading →
          </Link>
        )}
      </div>
    </div>
  );
}
