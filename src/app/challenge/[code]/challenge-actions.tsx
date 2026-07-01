"use client";

import { ShareCard } from "@/components/share-card";
import { CopyLinkButton } from "@/components/copy-link-button";

export function ChallengeActions({
  challengeLink,
  playerCode,
  displayName,
}: {
  challengeLink: string;
  playerCode: string;
  displayName: string;
}) {
  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap gap-2">
        <CopyLinkButton
          url={challengeLink}
          label="Copy challenge link"
          successMessage="Challenge link copied — send to your friend!"
        />
        <CopyLinkButton
          url={playerCode}
          label="Copy player code"
          successMessage="Player code copied!"
        />
      </div>
      <ShareCard
        kind="challenge"
        displayName={displayName}
        playerCode={playerCode}
      />
    </div>
  );
}
