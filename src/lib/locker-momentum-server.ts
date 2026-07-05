import { createClient } from "@/lib/supabase/server";
import type { HypnoticSession } from "@/lib/hypnotic-flow";

export interface LockerMomentumState {
  momentum: number;
  superUntil: number | null;
  superActive: boolean;
  superSecondsLeft: number;
  caseChain: number;
  wheelChain: number;
  affinityLabel: string | null;
}

export async function getLockerMomentum(_userId: string): Promise<LockerMomentumState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_locker_momentum");

  if (error || !data) {
    return {
      momentum: 0,
      superUntil: null,
      superActive: false,
      superSecondsLeft: 0,
      caseChain: 0,
      wheelChain: 0,
      affinityLabel: null,
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return {
      momentum: 0,
      superUntil: null,
      superActive: false,
      superSecondsLeft: 0,
      caseChain: 0,
      wheelChain: 0,
      affinityLabel: null,
    };
  }

  const superUntilMs = row.super_until
    ? new Date(row.super_until as string).getTime()
    : null;

  return {
    momentum: Number(row.momentum ?? 0),
    superUntil: superUntilMs,
    superActive: Boolean(row.super_active),
    superSecondsLeft: Number(row.super_seconds_left ?? 0),
    caseChain: Number(row.case_chain ?? 0),
    wheelChain: Number(row.wheel_chain ?? 0),
    affinityLabel: (row.affinity_label as string) ?? null,
  };
}

export function lockerMomentumToSession(state: LockerMomentumState): HypnoticSession {
  return {
    momentum: state.momentum,
    superUntil: state.superActive ? state.superUntil : null,
    recommendedStake: null,
    lastWinAmount: null,
    lastAnimal: null,
  };
}
