import { HUSTLE_TIER_LADDER } from "@/lib/hustle-oracle";
import type { HustleOracleProfile } from "@/lib/hustle-oracle";

export function HustleTierLadder({ oracle }: { oracle: HustleOracleProfile }) {
  return (
    <div className="hustle-tier-ladder">
      <p className="hustle-tier-ladder__title">Tier ladder</p>
      <ul className="hustle-tier-ladder__list">
        {HUSTLE_TIER_LADDER.map((step) => {
          const unlocked = oracle.hustle_tier >= step.tier;
          const current = oracle.hustle_tier === step.tier;
          return (
            <li
              key={step.tier}
              className={`hustle-tier-ladder__step ${unlocked ? "hustle-tier-ladder__step--unlocked" : ""} ${current ? "hustle-tier-ladder__step--current" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-zinc-100">
                  {step.label}
                  {current && (
                    <span className="ml-2 text-[9px] font-bold uppercase text-amber-300">
                      You
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {unlocked ? "Unlocked" : "Locked"}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-zinc-500">{step.description}</p>
              {!unlocked && (
                <p className="mt-1 text-[10px] text-zinc-600">
                  {step.sparkGate} Spark claims or Trust {step.trustGate}+
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
