import Link from "next/link";
import { DiscoveredStreamWatchView } from "@/components/discovered-stream-watch-view";
import { isEnabled } from "@/lib/feature-flags";
import { getBalance } from "@/lib/ledger";
import { createClient } from "@/lib/supabase/server";
import { getStreamWatchBets } from "@/lib/stream-watch-bets";
import { getStreamWatchComments } from "@/lib/stream-watch-comments";

export const revalidate = 0;

export default async function WatchDiscoveredStreamPage({
  searchParams,
}: {
  searchParams: Promise<{
    provider?: string;
    id?: string;
    title?: string;
    channel?: string;
    game?: string;
    market?: string;
  }>;
}) {
  const params = await searchParams;
  const provider = params.provider ?? "youtube";
  const id = params.id?.trim();
  const title = params.title?.trim() ?? "Live stream";
  const channel = params.channel?.trim() ?? "";
  const defaultMarketId = params.market?.trim() ?? null;

  if (!id) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold">Missing stream</h1>
        <Link href="/live" className="mt-4 inline-block text-sm text-sky-400 hover:underline">
          ← Watch hub
        </Link>
      </div>
    );
  }

  let watchUrl: string;
  if (provider === "youtube") {
    watchUrl = `https://www.youtube.com/watch?v=${id}`;
  } else if (provider === "twitch") {
    watchUrl = `https://www.twitch.tv/${id}`;
  } else if (provider === "kick") {
    watchUrl = `https://kick.com/${id}`;
  } else {
    watchUrl = id.startsWith("http") ? id : `https://${id}`;
  }

  const loginNext = `/live/watch?provider=${encodeURIComponent(provider)}&id=${encodeURIComponent(id)}&title=${encodeURIComponent(title)}&channel=${encodeURIComponent(channel)}`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [streamBets, streamComments, vibeBalance, quickExitEnabled] = await Promise.all([
    getStreamWatchBets({ provider, externalId: id, title }, user?.id ?? null),
    getStreamWatchComments(provider, id),
    user ? getBalance(user.id, "vibe") : Promise.resolve(0),
    isEnabled("quick_exit_enabled"),
  ]);

  return (
    <DiscoveredStreamWatchView
      watchUrl={watchUrl}
      title={title}
      channel={channel}
      provider={provider}
      streamExternalId={id}
      streamBets={streamBets}
      streamComments={streamComments}
      vibeBalance={user ? vibeBalance : 0}
      quickExitEnabled={quickExitEnabled}
      signedIn={!!user}
      loginNext={loginNext}
      defaultMarketId={defaultMarketId}
    />
  );
}
