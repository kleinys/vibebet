import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { GettingStartedBar } from "@/components/getting-started-bar";
import { PlayerModeSwitcher } from "@/components/player-mode-switcher";
import { InviteRewardsStrip } from "@/components/player-code-chip";
import { isEnabled } from "@/lib/feature-flags";
import { getPlayerPath } from "@/lib/player-path-server";
import { getMyPlayerCode } from "@/lib/player-code";
import { clientEnv } from "@/lib/env";
import type { PlayerPath } from "@/lib/player-path";

/** Sticky top shell — header, invite strip, mode bar, getting-started bar. */
export async function SiteChrome() {
  const mobileNavOn = await isEnabled("mobile_nav_enabled");
  const [pathPickerOn, referralsOn] = await Promise.all([
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
    if (pathPickerOn) {
      storedPath = await getPlayerPath(user.id);
      showModeBar = true;
    }
    const codeRow = await getMyPlayerCode();
    if (codeRow?.referral_code) {
      playerCode = codeRow.referral_code;
      if (referralsOn) {
        const siteUrl = clientEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
        inviteLink = `${siteUrl}/signup?ref=${playerCode}`;
      }
    }
  }

  return (
    <div
      className="sticky top-0 z-50 bg-zinc-950 shadow-sm shadow-black/20"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <Header mobileNavOn={mobileNavOn} />
      {playerCode && (
        <InviteRewardsStrip
          code={playerCode}
          referralsOn={referralsOn}
          inviteLink={inviteLink}
        />
      )}
      {showModeBar && <PlayerModeSwitcher storedPath={storedPath} />}
      <GettingStartedBar mobileNavOn={mobileNavOn} />
    </div>
  );
}
