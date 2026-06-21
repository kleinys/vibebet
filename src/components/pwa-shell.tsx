import { isEnabled } from "@/lib/feature-flags";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { PushSync } from "@/components/push-sync";

export async function PwaShell() {
  const [pwaOn, pushOn] = await Promise.all([
    isEnabled("pwa_enabled"),
    isEnabled("push_notifications_enabled"),
  ]);

  if (!pwaOn && !pushOn) return null;

  return (
    <>
      <PwaInstallPrompt enabled={pwaOn} />
      <PushSync enabled={pushOn} />
    </>
  );
}
