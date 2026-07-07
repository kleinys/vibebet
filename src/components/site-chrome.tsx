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
import type { MyPlayerCode } from "@/lib/player-code";

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
    // Only fetch user-specific data if user exists
    const promises = [];
    
    if (pathPickerOn) {
      promises.push(getPlayerPath(user.id));
    }
    
    if (referralsOn) {
      promises.push(getMyPlayerCode());
    }

    const results = await Promise.allSettled(promises);
    
    if (pathPickerOn && results[0].status === 'fulfilled') {
      storedPath = results[0].value;
      showModeBar = true;
    }
    
    if (referralsOn && results[pathPickerOn ? 1 : 0].status === 'fulfilled') {
      const codeRow = results[pathPickerOn ? 1 : 0].value;
      if (codeRow?.referral_code) {
        playerCode = codeRow.referral_code;
        if (referralsOn) {
          const siteUrl = clientEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
          inviteLink = `${siteUrl}/signup?ref=${playerCode}`;
        }
      }
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