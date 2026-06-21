import { Header } from "@/components/header";
import { GettingStartedBar } from "@/components/getting-started-bar";
import { isEnabled } from "@/lib/feature-flags";

/** Sticky top shell — header + getting-started bar stack without overlap. */
export async function SiteChrome() {
  const mobileNavOn = await isEnabled("mobile_nav_enabled");

  return (
    <div
      className="sticky top-0 z-50 bg-zinc-950 shadow-sm shadow-black/20"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <Header mobileNavOn={mobileNavOn} />
      <GettingStartedBar mobileNavOn={mobileNavOn} />
    </div>
  );
}
