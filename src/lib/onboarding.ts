import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface OnboardingState {
  step: number;
  interests: string[];
  first_bet_at: string | null;
  completed: boolean;
  skipped: boolean;
}

export async function getOnboardingState(): Promise<OnboardingState | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_onboarding_state");
  if (error) return null;
  const raw = data as Record<string, unknown> | null;
  if (!raw || raw.skipped === true && !raw.completed) {
    // unauthenticated returns skipped:true
    if (raw?.skipped && raw.step === undefined) return null;
  }
  return {
    step: Number(raw?.step ?? 0),
    interests: Array.isArray(raw?.interests)
      ? (raw.interests as string[])
      : [],
    first_bet_at: (raw?.first_bet_at as string) ?? null,
    completed: Boolean(raw?.completed),
    skipped: Boolean(raw?.skipped),
  };
}

export async function needsOnboarding(): Promise<boolean> {
  const state = await getOnboardingState();
  if (!state) return false;
  return !state.completed && !state.skipped;
}
