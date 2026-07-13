import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";

export async function MobileNavShell() {
  const enabled = await isEnabled("mobile_nav_enabled");
  if (!enabled) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [duelsOn, guildsOn, copyOn, limitsOn, tournamentsOn, questsOn, playHubOn, interconnectOn, modulesOn] =
    await Promise.all([
      isEnabled("duels_enabled"),
      isEnabled("guilds_enabled"),
      isEnabled("copy_trading_enabled"),
      isEnabled("limit_orders_enabled"),
      isEnabled("tournaments_enabled"),
      isEnabled("weekly_quests_enabled"),
      isEnabled("play_hub_enabled"),
      isEnabled("interconnect_layer_enabled"),
      isEnabled("user_modules_enabled"),
    ]);

  return (
    <MobileBottomNav
      duelsOn={duelsOn}
      guildsOn={guildsOn}
      copyOn={copyOn}
      limitsOn={limitsOn}
      tournamentsOn={tournamentsOn}
      questsOn={questsOn}
      isLoggedIn={Boolean(user)}
      playHubOn={playHubOn}
      interconnectOn={interconnectOn}
      modulesOn={modulesOn}
    />
  );
}