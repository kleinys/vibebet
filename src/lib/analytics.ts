"use server";

import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { capturePostHogEvent } from "@/lib/posthog-server";

/** Server-side product analytics — DB first, optional PostHog mirror. */
export async function trackEvent(
  eventName: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const props = properties ?? {};

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.rpc("track_event", {
      p_event_name: eventName,
      p_properties: props,
    });

    const forward = await isEnabled("posthog_forward_enabled");
    if (forward) {
      await capturePostHogEvent(eventName, props, user?.id ?? null);
    }
  } catch {
    if (process.env.NODE_ENV === "development") {
      console.info("[analytics]", eventName, props);
    }
  }
}
