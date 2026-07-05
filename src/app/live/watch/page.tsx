import Link from "next/link";
import { DiscoveredStreamWatchView } from "@/components/discovered-stream-watch-view";

export const revalidate = 0;

export default async function WatchDiscoveredStreamPage({
  searchParams,
}: {
  searchParams: Promise<{
    provider?: string;
    id?: string;
    title?: string;
    channel?: string;
  }>;
}) {
  const params = await searchParams;
  const provider = params.provider ?? "youtube";
  const id = params.id?.trim();
  const title = params.title?.trim() ?? "Live stream";
  const channel = params.channel?.trim() ?? "";

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

  return (
    <DiscoveredStreamWatchView
      watchUrl={watchUrl}
      title={title}
      channel={channel}
      provider={provider}
    />
  );
}
