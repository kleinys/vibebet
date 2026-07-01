"use client";

import { ShareCard } from "@/components/share-card";

export function WinSharePanel({
  displayName,
  username,
  headline,
}: {
  displayName: string;
  username?: string | null;
  headline: string;
}) {
  return (
    <div className="mt-4">
      <ShareCard
        kind="win"
        displayName={displayName}
        username={username}
        headline={headline}
        subline="Share the moment — invite friends to challenge you."
      />
    </div>
  );
}
