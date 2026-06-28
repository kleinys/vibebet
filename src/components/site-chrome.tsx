import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { GettingStartedBar } from "@/components/getting-started-bar";
import { PlayerModeSwitcher } from "@/components/player-mode-switcher";
import { isEnabled } from "@/lib/feature-flags";
import { getPlayerPath } from "@/lib/player-path-server";
import type { PlayerPath } from "@/lib/player-path";

/** Sticky top shell — header + mode bar + getting-started bar. */
export async function SiteChrome() {
  const mobileNavOn = await isEnabled("mobile_nav_enabled");
  const pathPickerOn = await isEnabled("player_path_picker_enabled");

  let storedPath: PlayerPath = "explore";
  let showModeBar = false;

  if (pathPickerOn) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      storedPath = await getPlayerPath(user.id);
      showModeBar = true;
    }
  }

  return (
    <div
      className="sticky top-0 z-50 bg-zinc-950 shadow-sm shadow-black/20"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <Header mobileNavOn={mobileNavOn} />
      {showModeBar && <PlayerModeSwitcher storedPath={storedPath} />}
      <GettingStartedBar mobileNavOn={mobileNavOn} />
    </div>
  );
}
