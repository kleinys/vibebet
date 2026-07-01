import { getShareProfile } from "@/lib/share-profile";
import { WinSharePanel } from "@/components/win-share-panel";

export async function DuelWinShareBlock({
  userId,
  winnerId,
  headline,
}: {
  userId: string;
  winnerId?: string | null;
  headline: string;
}) {
  if (!winnerId || winnerId !== userId) return null;

  const profile = await getShareProfile(userId);
  if (!profile) return null;

  return (
    <WinSharePanel
      displayName={profile.displayName}
      username={profile.username}
      headline={headline}
    />
  );
}
