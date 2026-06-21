"use client";

import { parseStreamUrl } from "@/lib/stream-url";

export function StreamEmbed({
  streamUrl,
  title,
  className,
}: {
  streamUrl: string | null | undefined;
  title?: string;
  className?: string;
}) {
  const parsed = parseStreamUrl(streamUrl);

  if (!parsed.embedUrl) {
    return (
      <div
        className={`flex aspect-video items-center justify-center rounded-xl border border-white/10 bg-zinc-900/80 ${className ?? ""}`}
      >
        <div className="px-6 text-center">
          <p className="text-sm font-medium text-zinc-300">No stream linked yet</p>
          <p className="mt-1 text-xs text-zinc-500">
            Host can paste YouTube, Twitch, Kick, Vimeo, Facebook Live, and more.
          </p>
          {parsed.watchUrl && (
            <a
              href={parsed.watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-xs text-fuchsia-400 hover:underline"
            >
              Open external link →
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-xl border border-white/10 bg-black ${className ?? ""}`}>
      <p className="border-b border-white/5 px-3 py-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
        {parsed.label}
      </p>
      <div className="relative aspect-video w-full">
        <iframe
          src={parsed.embedUrl}
          title={title ?? "Live stream"}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    </div>
  );
}
