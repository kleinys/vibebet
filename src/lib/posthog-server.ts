import "server-only";

const DEFAULT_HOST = "https://us.i.posthog.com";

export async function capturePostHogEvent(
  eventName: string,
  properties: Record<string, unknown>,
  distinctId: string | null,
): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) return;

  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? DEFAULT_HOST).replace(
    /\/$/,
    "",
  );

  try {
    await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        event: eventName,
        distinct_id: distinctId ?? "anonymous",
        properties: {
          ...properties,
          source: "vibebet_server",
        },
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Never block product flows on analytics.
  }
}

export function postHogConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
}
