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
  clampMomentum,
  createSession,
  isSuperActive,
  momentumDelta,
  nearestCrateStake,
  SUPER_MODE_MS,
  type HypnoticCinema,
  type HypnoticMode,
  type HypnoticReaction,
  type HypnoticSession,
} from "@/lib/hypnotic-flow";

interface HypnoticFlowValue {
  mode: HypnoticMode;
  setMode: (mode: HypnoticMode) => void;
  reaction: HypnoticReaction;
  cinema: HypnoticCinema;
  momentum: number;
  superActive: boolean;
  superSecondsLeft: number;
  recommendedStake: number | null;
  stakeDocked: boolean;
  setStakeDocked: (docked: boolean) => void;
  clearRecommendedStake: () => void;
  onWheelWin: (payout: number) => void;
  onCaseResult: (net: number) => void;
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

export function HypnoticFlowProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<HypnoticSession>(createSession);
  const [mode, setModeState] = useState<HypnoticMode>("wheel");
  const [reaction, setReaction] = useState<HypnoticReaction>("idle");
  const [cinema, setCinema] = useState<HypnoticCinema>("idle");
  const [stakeDocked, setStakeDocked] = useState(false);
  const [morphing, setMorphing] = useState(false);
  const [vibeOrbs, setVibeOrbs] = useState<{ id: number; amount: number }[]>([]);
  const [tick, setTick] = useState(0);

  const superActive = isSuperActive(session.superUntil);

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

  const bumpMomentum = useCallback((delta: number) => {
    setSession((prev) => {
      const momentum = clampMomentum(prev.momentum + delta);
      const hitSuper = momentum >= 100 && !isSuperActive(prev.superUntil);
      return {
        ...prev,
        momentum,
        superUntil: hitSuper ? Date.now() + SUPER_MODE_MS : prev.superUntil,
      };
    });
    if (delta > 0) {
      setReaction("approve");
      window.setTimeout(() => setReaction((r) => (r === "approve" ? "idle" : r)), 1800);
    }
  }, []);

  const onWheelWin = useCallback(
    (payout: number) => {
      bumpMomentum(momentumDelta("wheel-win"));
      const stake = nearestCrateStake(payout);
      setSession((prev) => ({
        ...prev,
        recommendedStake: stake,
        lastWinAmount: payout,
      }));
      setStakeDocked(false);
      setCinema("vibe-absorb");
      setReaction("approve");
      const orbId = Date.now();
      setVibeOrbs([{ id: orbId, amount: payout }]);
      window.setTimeout(() => {
        setVibeOrbs([]);
        setCinema("idle");
        setMode("case");
      }, 2200);
    },
    [bumpMomentum, setMode],
  );

  const onCaseResult = useCallback(
    (net: number) => {
      bumpMomentum(momentumDelta(net >= 0 ? "case-win" : "case-lose"));
      if (net >= 0) {
        setCinema("confetti");
        window.setTimeout(() => setCinema("idle"), 1600);
      }
    },
    [bumpMomentum],
  );

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
    if (superActive) setReaction("super");
    else if (reaction === "super") setReaction("idle");
  }, [superActive, reaction]);

  const value = useMemo<HypnoticFlowValue>(
    () => ({
      mode,
      setMode,
      reaction,
      cinema,
      momentum: session.momentum,
      superActive,
      superSecondsLeft,
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
