import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { GettingStartedBar } from "@/components/getting-started-bar";
import { PlayerModeSwitcher } from "@/components/player-mode-switcher";
import { PlayerCodeHero } from "@/components/player-code-chip";
import { CollapsibleSiteChrome } from "@/components/collapsible-site-chrome";
import { isEnabled } from "@/lib/feature-flags";
import { getPlayerPath } from "@/lib/player-path-server";
import { getMyPlayerCode } from "@/lib/player-code";
import { clientEnv } from "@/lib/env";
import type { PlayerPath } from "@/lib/player-path";

/** Sticky top shell — header, collapsible nav + player code, getting-started bar. */
export async function SiteChrome() {
  // Fetch feature flags once with Promise.all for efficiency
  const [mobileNavOn, pathPickerOn, referralsOn] = await Promise.all([
    isEnabled("mobile_nav_enabled"),
    isEnabled("player_path_picker_enabled"),
    isEnabled("referrals_enabled"),
  ]);

  let storedPath: PlayerPath = "explore";
  let showModeBar = false;
  let playerCode: string | null = null;
  let inviteLink: string | null = null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const [pathResult, codeRow] = await Promise.all([
      pathPickerOn ? getPlayerPath(user.id) : Promise.resolve(null),
      referralsOn ? getMyPlayerCode() : Promise.resolve(null),
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
  }

  const hasCollapsible = user && (showModeBar || playerCode);

  return (
    <div
      className="sticky top-0 z-50 bg-zinc-950 shadow-sm shadow-black/20"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <Header mobileNavOn={mobileNavOn} />
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