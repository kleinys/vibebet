"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { enableHustleRecovery, setHustleRegion } from "@/app/play/actions";
import {
  HUSTLE_REGIONS,
  type HustleRegion,
  type HustleWellnessState,
} from "@/lib/hustle/shared";
import { formatVibe } from "@/lib/utils";

const RECOVERY_OPTIONS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

export function HustleWellnessPanel({
  wellness,
  onUpdate,
}: {
  wellness: HustleWellnessState;
  onUpdate: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmRecovery, setConfirmRecovery] = useState<number | null>(null);

  const capPct =
    wellness.daily_earn_cap && wellness.daily_earn_cap > 0
      ? Math.min(100, Math.round((wellness.earned_today / wellness.daily_earn_cap) * 100))
      : 0;

  function saveRegion(region: HustleRegion) {
    startTransition(async () => {
      const result = await setHustleRegion(region);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Region set to ${HUSTLE_REGIONS.find((r) => r.id === region)?.label}`);
      onUpdate();
    });
  }

  function activateRecovery(days: number) {
    startTransition(async () => {
      const result = await enableHustleRecovery(days);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Recovery mode on for ${days} days — earn-only, play bridge locked`);
      setConfirmRecovery(null);
      onUpdate();
    });
  }

  return (
    <section className="hustle-wellness-panel">
      <div className="hustle-wellness-panel__header">
        <div>
          <p className="hustle-wellness-panel__eyebrow">Recovery &amp; region</p>
          <h3 className="hustle-wellness-panel__title">Earn responsibly</h3>
          <p className="hustle-wellness-panel__sub">
            Recovery mode keeps you in the earn loop with a daily cap and blocks moving Hustle
            Cash to Play VIBE.
          </p>
        </div>
      </div>

      {wellness.recovery_mode && (
        <div className="hustle-wellness-panel__banner hustle-wellness-panel__banner--active">
          <strong>Recovery mode active</strong>
          {wellness.recovery_until && (
            <span> until {new Date(wellness.recovery_until).toLocaleDateString()}</span>
          )}
          {wellness.daily_earn_cap != null && (
            <p className="mt-2 text-xs">
              Earned today: {formatVibe(wellness.earned_today)} /{" "}
              {formatVibe(wellness.daily_earn_cap)} cap
            </p>
          )}
          {wellness.daily_earn_cap != null && (
            <div className="hustle-wellness-panel__cap-bar mt-2" aria-hidden>
              <div className="hustle-wellness-panel__cap-fill" style={{ width: `${capPct}%` }} />
            </div>
          )}
        </div>
      )}

      {!wellness.recovery_mode && (
        <div className="hustle-wellness-panel__recovery">
          <p className="text-xs text-zinc-400">Enable recovery (earn-only):</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {RECOVERY_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                type="button"
                disabled={pending}
                className="hustle-wellness-panel__recovery-btn"
                onClick={() => setConfirmRecovery(opt.days)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {confirmRecovery != null && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-xs text-amber-100">
                Lock earn→play for {confirmRecovery} days and cap daily earn at 1,500 Hustle Cash?
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  className="hustle-wellness-panel__confirm"
                  onClick={() => activateRecovery(confirmRecovery)}
                >
                  Yes, enable
                </button>
                <button
                  type="button"
                  className="text-xs text-zinc-400 hover:text-zinc-200"
                  onClick={() => setConfirmRecovery(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="hustle-wellness-panel__region mt-5">
        <p className="hustle-wellness-panel__section-title">Regional pack</p>
        <p className="mb-2 text-xs text-zinc-500">
          {wellness.regional_gig_count} platform gigs match <strong>{wellness.region_label}</strong>
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {HUSTLE_REGIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              disabled={pending}
              className={`hustle-wellness-panel__region-btn ${wellness.region === r.id ? "is-active" : ""}`}
              onClick={() => saveRegion(r.id)}
            >
              <span className="font-semibold text-zinc-100">{r.label}</span>
              <span className="mt-0.5 block text-[10px] text-zinc-500">{r.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
