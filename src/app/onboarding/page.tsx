import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { getOnboardingState } from "@/lib/onboarding";
import { getStarterMarketId } from "./actions";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage() {
  const enabled = await isEnabled("onboarding_wizard_enabled");
  if (!enabled) redirect("/markets");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");

  const state = await getOnboardingState();
  if (state?.completed || state?.skipped) {
    const { hubForPath } = await import("@/lib/player-path");
    redirect(hubForPath(state.playerPath));
  }

  const starterMarketId = await getStarterMarketId();

  return (
    <OnboardingWizard
      starterMarketId={starterMarketId}
      initialStep={state?.step ?? 0}
      initialPath={state?.playerPath ?? "explore"}
    />
  );
}
