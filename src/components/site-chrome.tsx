import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { GettingStartedBar } from "@/components/getting-started-bar";
import { PlayerModeSwitcher } from "@/components/player-mode-switcher";
import { PlayerCodeHero } from "@/components/player-code-chip";
import { CollapsibleSiteChrome } from "@/components/collapsible-site-chrome";
import { VibePassBar } from "@/components/vibe-pass-bar";
import { NameCompanionPrompt } from "@/components/name-companion-prompt";
import { isEnabled } from "@/lib/feature-flags";
import { getPlayerPath } from "@/lib/player-path-server";
import { getMyPlayerCode } from "@/lib/player-code";
import { getVibePassProgress } from "@/lib/vibe-pass";
import { clientEnv } from "@/lib/env";
import type { PlayerPath } from "@/lib/player-path";

/** Sticky top shell — header, collapsible nav + player code, getting-started bar. */
export async function SiteChrome() {
  const [mobileNavOn, pathPickerOn, referralsOn, psychologyOn] = await Promise.all([
    isEnabled("mobile_nav_enabled"),
    isEnabled("player_path_picker_enabled"),
    isEnabled("referrals_enabled"),
    isEnabled("psychology_layer_enabled"),
  ]);

  let storedPath: PlayerPath = "explore";
  let showModeBar = false;
  let playerCode: string | null = null;
  let inviteLink: string | null = null;
  let vibePass = null;
  let needsCompanionName = false;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const [pathResult, codeRow, passProgress, profileRow] = await Promise.all([
      pathPickerOn ? getPlayerPath(user.id) : Promise.resolve(null),
      referralsOn ? getMyPlayerCode() : Promise.resolve(null),
      psychologyOn ? getVibePassProgress() : Promise.resolve(null),
      psychologyOn
        ? supabase
            .from("profiles")
            .select("companion_name")
            .eq("id", user.id)
            .maybeSingle()
            .then((r) => r.data)
        : Promise.resolve(null),
    ]);

    if (pathPickerOn && pathResult) {
      storedPath = pathResult;
      showModeBar = true;
    }

    if (referralsOn && codeRow?.referral_code) {
      playerCode = codeRow.referral_code;
      const siteUrl = clientEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
      inviteLink = `${siteUrl}/signup?ref=${playerCode}`;
    }

    vibePass = passProgress;
    needsCompanionName = psychologyOn && !profileRow?.companion_name;
  }

  const hasCollapsible = user && (showModeBar || playerCode);

  return (
    <div
      className="sticky top-0 z-50 bg-zinc-950 shadow-sm shadow-black/20"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <Header mobileNavOn={mobileNavOn} />
      {psychologyOn && vibePass?.visible && <VibePassBar progress={vibePass} />}
      {psychologyOn && needsCompanionName && <NameCompanionPrompt />}
      {hasCollapsible ? (
        <CollapsibleSiteChrome storedPath={storedPath} playerCode={playerCode}>
          {showModeBar && <PlayerModeSwitcher storedPath={storedPath} />}
          {playerCode && (
            <PlayerCodeHero
              code={playerCode}
              referralsOn={referralsOn}
              inviteLink={inviteLink}
            />
          )}
          <GettingStartedBar mobileNavOn={mobileNavOn} />
        </CollapsibleSiteChrome>
      ) : (
        <>
          {showModeBar && <PlayerModeSwitcher storedPath={storedPath} />}
          {playerCode && (
            <PlayerCodeHero
              code={playerCode}
              referralsOn={referralsOn}
              inviteLink={inviteLink}
            />
          )}
          <GettingStartedBar mobileNavOn={mobileNavOn} />
        </>
      )}
    </div>
  );
}
