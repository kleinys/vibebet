import type { AnimalKind } from "@/lib/companion-figure";
import type { SpiritMorphElement } from "@/lib/companion-motion";
import { rosterBySkin } from "@/lib/companion-roster";

export type OrbitArchetype =
  | "volatile"
  | "steady"
  | "streak"
  | "arcane";

export interface OrbitAffinity {
  archetype: OrbitArchetype;
  label: string;
  shortLabel: string;
  icon: string;
  crateEffect: string;
  wheelEffect: string;
  caseTheme: string;
  wheelTheme: string;
}

const AFFINITY: Record<OrbitArchetype, OrbitAffinity> = {
  volatile: {
    archetype: "volatile",
    label: "High-Risk Volatility",
    shortLabel: "Volatile",
    icon: "🔥",
    crateEffect: "Jackpot payout +10% — common tier odds drop",
    wheelEffect: "Lose segments pay 0 — big wins hit harder",
    caseTheme: "from-orange-950/80 via-red-950/40 to-zinc-950",
    wheelTheme: "from-amber-900/30 via-orange-950/20 to-zinc-950",
  },
  steady: {
    archetype: "steady",
    label: "Safe & Steady",
    shortLabel: "Steady",
    icon: "🛡",
    crateEffect: "Worst tier −20% weight — 10% loss floor",
    wheelEffect: "Lower peak multiplier — protected floor on losses",
    caseTheme: "from-slate-900/80 via-indigo-950/40 to-zinc-950",
    wheelTheme: "from-slate-900/50 via-indigo-950/30 to-zinc-950",
  },
  streak: {
    archetype: "streak",
    label: "Streak Builder",
    shortLabel: "Streak",
    icon: "⚡",
    crateEffect: "Chain +2% per case in a row (caps at +10%)",
    wheelEffect: "Consecutive spins stack multiplier until a miss",
    caseTheme: "from-yellow-950/60 via-slate-900/50 to-zinc-950",
    wheelTheme: "from-yellow-950/40 via-slate-900/40 to-zinc-950",
  },
  arcane: {
    archetype: "arcane",
    label: "All-or-Nothing Arcane",
    shortLabel: "Arcane",
    icon: "✦",
    crateEffect: "5% chance to upgrade lowest tier to mid tier",
    wheelEffect: "6 segments only — jackpot takes 25% of the wheel",
    caseTheme: "from-violet-950/80 via-purple-950/50 to-zinc-950",
    wheelTheme: "from-violet-950/50 via-fuchsia-950/30 to-zinc-950",
  },
};

const MORPH_ARCHETYPE: Partial<Record<SpiritMorphElement, OrbitArchetype>> = {
  fire: "volatile",
  forge: "volatile",
  solar: "volatile",
  reddwarf: "volatile",
  lunar: "steady",
  frost: "steady",
  aurora: "steady",
  neon: "steady",
  voidrift: "streak",
  thunder: "streak",
  storm: "streak",
  cosmic: "arcane",
  nebula: "arcane",
  eclipse: "arcane",
  rune: "arcane",
  arcane: "arcane",
};

export interface SynergyBonus {
  label: string;
  effect: string;
}

const SYNERGY: Partial<Record<string, SynergyBonus>> = {
  "frost-walker|serpent": {
    label: "Ice Affinity",
    effect: "+5% VIBE case winnings",
  },
  "storm-titan|bear": {
    label: "Storm Affinity",
    effect: "+8% streak chain bonus",
  },
  "nebula-ronin|crane": {
    label: "Nebula Affinity",
    effect: "+1 wheel segment (+5% rare weight)",
  },
  "blood-moon|bat": {
    label: "Eclipse Affinity",
    effect: "−3% VIBE case cost",
  },
  "aurora-sage|owl": {
    label: "Polar Affinity",
    effect: "+2s floor protection window",
  },
};

export function archetypeForMorph(morph: SpiritMorphElement): OrbitArchetype {
  return MORPH_ARCHETYPE[morph] ?? "steady";
}

export function orbitAffinityForMorph(morph: SpiritMorphElement): OrbitAffinity {
  return AFFINITY[archetypeForMorph(morph)];
}

export function orbitAffinityForSkin(skinSlug: string | null | undefined): OrbitAffinity | null {
  const roster = rosterBySkin(skinSlug ?? "");
  if (!roster) return null;
  return orbitAffinityForMorph(roster.morph);
}

export function synergyForPair(
  skinSlug: string | null | undefined,
  animal: AnimalKind,
): SynergyBonus | null {
  if (!skinSlug) return null;
  return SYNERGY[`${skinSlug}|${animal}`] ?? null;
}

export function orbitModifierSummary(skinSlug: string | null | undefined): {
  morphLabel: string;
  affinity: OrbitAffinity;
  synergy: SynergyBonus | null;
} | null {
  const roster = rosterBySkin(skinSlug ?? "");
  if (!roster) return null;
  const affinity = orbitAffinityForMorph(roster.morph);
  const synergy = synergyForPair(skinSlug, roster.animal);
  return {
    morphLabel: roster.elementLabel,
    affinity,
    synergy,
  };
}
