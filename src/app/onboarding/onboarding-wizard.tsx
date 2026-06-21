"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  CATEGORY_LABELS,
  MARKET_CATEGORIES,
  type MarketCategory,
} from "@/lib/supabase/types";
import { saveInterests, finishOnboarding } from "./actions";

const STEPS = [
  "Pick your vibe",
  "How it works",
  "First bet",
  "You're in",
] as const;

export function OnboardingWizard({
  starterMarketId,
  initialStep,
}: {
  starterMarketId: string | null;
  initialStep: number;
}) {
  const [step, setStep] = useState(Math.min(initialStep, 3));
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleInterest(cat: string) {
    setSelected((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }

  function nextFromInterests() {
    startTransition(async () => {
      const result = await saveInterests(selected);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setStep(1);
    });
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <div className="flex gap-2">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`h-1 flex-1 rounded-full ${
              i <= step ? "bg-fuchsia-500" : "bg-zinc-800"
            }`}
            title={label}
          />
        ))}
      </div>

      {step === 0 && (
        <section className="mt-10">
          <h1 className="text-2xl font-semibold">What are you into?</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Pick at least one — we&apos;ll surface markets you&apos;ll actually care about.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {MARKET_CATEGORIES.map((cat) => {
              const on = selected.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleInterest(cat)}
                  className={
                    on
                      ? "rounded-full border border-fuchsia-500/50 bg-fuchsia-500/15 px-4 py-2 text-sm text-fuchsia-200"
                      : "rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:border-white/20"
                  }
                >
                  {CATEGORY_LABELS[cat as MarketCategory]}
                </button>
              );
            })}
          </div>
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
          <button
            type="button"
            disabled={pending || selected.length === 0}
            onClick={nextFromInterests}
            className="mt-8 w-full rounded-md bg-fuchsia-500 py-2.5 text-sm font-medium text-white hover:bg-fuchsia-400 disabled:opacity-50"
          >
            Continue
          </button>
        </section>
      )}

      {step === 1 && (
        <section className="mt-10">
          <h1 className="text-2xl font-semibold">How betting works</h1>
          <ol className="mt-6 space-y-4 text-sm text-zinc-300">
            <li className="rounded-lg border border-white/5 bg-zinc-900/40 p-4">
              <strong className="text-zinc-100">1.</strong> Odds = crowd probability.
              60% Yes means the market thinks there&apos;s a 60% chance.
            </li>
            <li className="rounded-lg border border-white/5 bg-zinc-900/40 p-4">
              <strong className="text-zinc-100">2.</strong> Buy the side you believe in.
              Winning shares pay 1 VIBE each at resolution.
            </li>
            <li className="rounded-lg border border-white/5 bg-zinc-900/40 p-4">
              <strong className="text-zinc-100">3.</strong> Your accuracy is tracked —
              pick well and climb Sharp Minds, not just profit.
            </li>
          </ol>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="mt-8 w-full rounded-md bg-fuchsia-500 py-2.5 text-sm font-medium text-white hover:bg-fuchsia-400"
          >
            Got it — let me bet
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="mt-10">
          <h1 className="text-2xl font-semibold">Place your first bet</h1>
          <p className="mt-2 text-sm text-zinc-400">
            This is the activation moment. Pick a trending market and throw down
            10–100 VIBE. You can always sell before it closes.
          </p>
          {starterMarketId ? (
            <Link
              href={`/markets/${starterMarketId}?onboarding=1`}
              className="mt-6 block rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-5 text-center text-sm font-medium text-fuchsia-200 hover:bg-fuchsia-500/15"
            >
              Open starter market →
            </Link>
          ) : (
            <Link
              href="/markets"
              className="mt-6 block rounded-xl border border-white/10 p-5 text-center text-sm hover:bg-zinc-900"
            >
              Browse markets →
            </Link>
          )}
          <button
            type="button"
            onClick={() => setStep(3)}
            className="mt-4 w-full text-xs text-zinc-500 hover:text-zinc-300"
          >
            I already placed a bet — continue
          </button>
        </section>
      )}

      {step === 3 && (
        <section className="mt-10 text-center">
          <p className="text-4xl">🎉</p>
          <h1 className="mt-4 text-2xl font-semibold">You&apos;re in</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Explore Lightning Rounds, pitch markets, and build your predictor
            reputation.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => finishOnboarding(false))}
            className="mt-8 w-full rounded-md bg-fuchsia-500 py-2.5 text-sm font-medium text-white hover:bg-fuchsia-400 disabled:opacity-50"
          >
            Enter Vibebet
          </button>
        </section>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => finishOnboarding(true))}
        className="mt-6 w-full text-xs text-zinc-600 hover:text-zinc-400"
      >
        Skip for now
      </button>
    </div>
  );
}
