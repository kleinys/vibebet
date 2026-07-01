"use client";

import { CopyLinkButton } from "@/components/copy-link-button";

export function WatchLinkBar({
  url,
  label = "Copy watch link",
}: {
  url: string;
  label?: string;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <CopyLinkButton
        url={url}
        label={label}
        successMessage="Watch link copied — send to friends!"
        className="rounded-md bg-violet-600/40 px-3 py-1.5 text-xs font-medium text-violet-100 ring-1 ring-violet-500/30 hover:bg-violet-500/50"
      />
    </div>
  );
}
