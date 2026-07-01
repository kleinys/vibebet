"use client";

import { ShareCard } from "@/components/share-card";

export function ProfileShareSection({
  displayName,
  username,
  playerCode,
  streak,
}: {
  displayName: string;
  username?: string | null;
  playerCode: string;
  streak?: number;
}) {
  return (
    <div className="mt-4 space-y-3">
      <ShareCard
        kind="challenge"
        displayName={displayName}
        username={username}
        playerCode={playerCode}
      />
      {streak != null && streak >= 3 && (
        <ShareCard
          kind="streak"
          displayName={displayName}
          username={username}
          streak={streak}
        />
      )}
    </div>
  );
}
