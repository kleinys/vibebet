/** Client-safe streak loss countdown helpers (UTC midnight reset). */

export interface StreakUrgency {
  /** Hours until UTC midnight when streak can break if inactive today */
  hoursLeft: number;
  minutesLeft: number;
  /** User already recorded activity today */
  activeToday: boolean;
  /** Show countdown in header */
  showTimer: boolean;
  /** Short label for compact UI */
  label: string;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function streakUrgency(
  currentStreak: number,
  lastActiveDate: string | null,
): StreakUrgency {
  const activeToday = lastActiveDate === todayUtc();
  const now = new Date();
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  const msLeft = Math.max(0, midnight.getTime() - now.getTime());
  const hoursLeft = Math.floor(msLeft / 3_600_000);
  const minutesLeft = Math.floor((msLeft % 3_600_000) / 60_000);

  const showTimer = currentStreak > 0 && !activeToday;

  let label = "";
  if (showTimer) {
    if (hoursLeft > 0) {
      label = `${hoursLeft}h ${minutesLeft}m to save streak`;
    } else {
      label = `${minutesLeft}m to save streak`;
    }
  }

  return { hoursLeft, minutesLeft, activeToday, showTimer, label };
}
