import { isEnabled } from "@/lib/feature-flags";
import { getActivityFeed } from "@/lib/activity-feed";
import { LiveActivityFeed } from "@/components/live-activity-feed";

export async function LiveFeedSection({ limit = 12 }: { limit?: number }) {
  if (!(await isEnabled("live_feed_enabled"))) return null;
  const initial = await getActivityFeed(limit);
  return (
    <section className="mx-auto max-w-6xl px-6 pt-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Live activity
      </h2>
      <div className="mt-3 max-h-64 overflow-y-auto">
        <LiveActivityFeed initial={initial} />
      </div>
    </section>
  );
}
