"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  nearestCrateStake,
  type HypnoticCinema,
  type HypnoticMode,
  type HypnoticReaction,
  type HypnoticSession,
} from "@/lib/hypnotic-flow";

export interface RpcMomentumSync {
  momentum: number;
  superActive: boolean;
  superSecondsLeft: number;
  superUntil: number | null;
  payoutMultiplier: number;
  affinityLabel: string | null;
  isJackpot: boolean;
}

interface HypnoticFlowValue {
  mode: HypnoticMode;
  setMode: (mode: HypnoticMode) => void;
  reaction: HypnoticReaction;
  cinema: HypnoticCinema;
  momentum: number;
  superActive: boolean;
  superSecondsLeft: number;
  payoutMultiplier: number;
  affinityLabel: string | null;
  lastJackpot: boolean;
  recommendedStake: number | null;
  stakeDocked: boolean;
  setStakeDocked: (docked: boolean) => void;
  clearRecommendedStake: () => void;
  onWheelWin: (payout: number, sync: RpcMomentumSync) => void;
  onCaseResult: (net: number, sync: RpcMomentumSync) => void;
  setCinema: (cinema: HypnoticCinema) => void;
  setReaction: (reaction: HypnoticReaction) => void;
  triggerAfterglow: (animal: string) => void;
  vibeOrbs: { id: number; amount: number }[];
  clearVibeOrbs: () => void;
  morphing: boolean;
}

const HypnoticFlowContext = createContext<HypnoticFlowValue | null>(null);

export function useHypnoticFlow() {
  const ctx = useContext(HypnoticFlowContext);
  if (!ctx) throw new Error("useHypnoticFlow must be used within HypnoticFlowProvider");
  return ctx;
}

export function useHypnoticFlowOptional() {
  return useContext(HypnoticFlowContext);
}

function applySync(
  prev: HypnoticSession,
  sync: RpcMomentumSync,
): HypnoticSession {
  return {
    ...prev,
    momentum: sync.momentum,
    superUntil: sync.superActive
      ? sync.superUntil ?? Date.now() + sync.superSecondsLeft * 1000
      : null,
  };
}

export function HypnoticFlowProvider({
  children,
  initialSession,
  initialAffinityLabel = null,
}: {
  children: ReactNode;
  initialSession?: HypnoticSession;
  initialAffinityLabel?: string | null;
}) {
  const [session, setSession] = useState<HypnoticSession>(initialSession ?? { momentum: 0, superUntil: null, recommendedStake: null, lastWinAmount: null, lastAnimal: null });
  const [mode, setModeState] = useState<HypnoticMode>("wheel");
  const [reaction, setReaction] = useState<HypnoticReaction>("idle");
  const [cinema, setCinema] = useState<HypnoticCinema>("idle");
  const [stakeDocked, setStakeDocked] = useState(false);
  const [morphing, setMorphing] = useState(false);
  const [vibeOrbs, setVibeOrbs] = useState<{ id: number; amount: number }[]>([]);
  const [payoutMultiplier, setPayoutMultiplier] = useState(1);
  const [affinityLabel, setAffinityLabel] = useState<string | null>(initialAffinityLabel);
  const [lastJackpot, setLastJackpot] = useState(false);
  const [, setTick] = useState(0);

  const superActive = session.superUntil !== null && session.superUntil > Date.now();

  useEffect(() => {
    if (!session.superUntil) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 500);
    return () => window.clearInterval(id);
  }, [session.superUntil]);

  const superSecondsLeft = session.superUntil
    ? Math.max(0, Math.ceil((session.superUntil - Date.now()) / 1000))
    : 0;

  const setMode = useCallback((next: HypnoticMode) => {
    setMorphing(true);
    setModeState(next);
    window.setTimeout(() => setMorphing(false), 700);
  }, []);

  const onWheelWin = useCallback(
    (payout: number, sync: RpcMomentumSync) => {
      setSession((prev) => ({
        ...applySync(prev, sync),
        recommendedStake: nearestCrateStake(payout),
        lastWinAmount: payout,
      }));
      setPayoutMultiplier(sync.payoutMultiplier);
      setAffinityLabel(sync.affinityLabel);
      setLastJackpot(sync.isJackpot);
      setStakeDocked(false);
      setCinema("vibe-absorb");
      setReaction(sync.superActive ? "super" : "approve");
      const orbId = Date.now();
      setVibeOrbs([{ id: orbId, amount: payout }]);
      window.setTimeout(() => {
        setVibeOrbs([]);
        setCinema("idle");
        setMode("case");
      }, 2200);
    },
    [setMode],
  );

  const onCaseResult = useCallback((net: number, sync: RpcMomentumSync) => {
    setSession((prev) => applySync(prev, sync));
    setPayoutMultiplier(sync.payoutMultiplier);
    setAffinityLabel(sync.affinityLabel);
    setLastJackpot(sync.isJackpot);
    if (net >= 0) {
      setCinema("confetti");
      setReaction(sync.superActive ? "super" : "approve");
      window.setTimeout(() => setCinema("idle"), 1600);
    }
  }, []);

  const clearRecommendedStake = useCallback(() => {
    setSession((prev) => ({ ...prev, recommendedStake: null }));
    setStakeDocked(false);
  }, []);

  const triggerAfterglow = useCallback((animal: string) => {
    setReaction("afterglow");
    setSession((prev) => ({ ...prev, lastAnimal: animal }));
    window.setTimeout(() => setReaction("idle"), 10_000);
  }, []);

  const clearVibeOrbs = useCallback(() => setVibeOrbs([]), []);

  useEffect(() => {
    if (superActive && reaction !== "afterglow" && cinema === "idle") {
      setReaction("super");
    } else if (!superActive && reaction === "super") {
      setReaction("idle");
    }
  }, [superActive, reaction, cinema]);

  const value = useMemo<HypnoticFlowValue>(
    () => ({
      mode,
      setMode,
      reaction,
      cinema,
      momentum: session.momentum,
      superActive,
      superSecondsLeft,
      payoutMultiplier,
      affinityLabel,
      lastJackpot,
      recommendedStake: session.recommendedStake,
      stakeDocked,
      setStakeDocked,
      clearRecommendedStake,
      onWheelWin,
      onCaseResult,
      setCinema,
      setReaction,
      triggerAfterglow,
      vibeOrbs,
      clearVibeOrbs,
      morphing,
    }),
    [
      mode,
      setMode,
      reaction,
      cinema,
      session.momentum,
      session.recommendedStake,
      superActive,
      superSecondsLeft,
      payoutMultiplier,
      affinityLabel,
      lastJackpot,
      stakeDocked,
      clearRecommendedStake,
      onWheelWin,
      onCaseResult,
      triggerAfterglow,
      vibeOrbs,
      clearVibeOrbs,
      morphing,
    ],
  );

  return <HypnoticFlowContext.Provider value={value}>{children}</HypnoticFlowContext.Provider>;
}
