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

  const [duelsOn, guildsOn, copyOn, limitsOn, tournamentsOn, questsOn] =
    await Promise.all([
      isEnabled("duels_enabled"),
      isEnabled("guilds_enabled"),
      isEnabled("copy_trading_enabled"),
      isEnabled("limit_orders_enabled"),
      isEnabled("tournaments_enabled"),
      isEnabled("weekly_quests_enabled"),
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
    />
  );
}
