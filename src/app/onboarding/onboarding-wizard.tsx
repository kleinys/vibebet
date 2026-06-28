"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  CATEGORY_LABELS,
  MARKET_CATEGORIES,
  type MarketCategory,
} from "@/lib/supabase/types";
import {
  PLAYER_PATHS,
  pathOption,
  type PlayerPath,
} from "@/lib/player-path";
import { filledNavBtn } from "@/lib/nav-button-styles";
import {
  saveInterests,
  savePlayerPath,
  finishOnboarding,
} from "./actions";

const STEPS = ["Your vibe", "Focus", "How it works", "First move", "Done"] as const;

export function OnboardingWizard({
  starterMarketId,
  initialStep,
  initialPath,
}: {
  starterMarketId: string | null;
  initialStep: number;
  initialPath: PlayerPath;
}) {
  const [step, setStep] = useState(Math.min(initialStep, 4));
  const [path, setPath] = useState<PlayerPath>(
    initialPath === "explore" ? "predict" : initialPath,
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pathMeta = pathOption(path);

  function toggleInterest(cat: string) {
    setSelected((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }

  function choosePath(next: PlayerPath) {
    setPath(next);
    startTransition(async () => {
      const result = await savePlayerPath(next);
      if (result.error) setError(result.error);
      else setError(null);
    });
  }

  function continueFromPath() {
    startTransition(async () => {
      const result = await savePlayerPath(path);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setStep(1);
    });
  }

  function nextFromInterests() {
    startTransition(async () => {
      const result = await saveInterests(selected);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setStep(2);
    });
  }

  function skipInterests() {
    setStep(2);
  }

  const firstActionHref =
    path === "predict" && starterMarketId
      ? `/markets/${starterMarketId}?onboarding=1`
      : pathMeta.firstActionHref;

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
          <h1 className="text-2xl font-semibold">What brings you here?</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Pick a lane to start — you can switch anytime from the mode bar at the
            top.
          </p>
          <div className="mt-6 space-y-3">
            {PLAYER_PATHS.map((mode) => {
              const on = path === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => choosePath(mode.id)}
                  className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition ${
                    on
                      ? "border-fuchsia-500/50 bg-fuchsia-500/10 shadow-lg shadow-fuchsia-950/30"
                      : "border-white/10 bg-zinc-900/40 hover:border-white/20"
                  }`}
                >
                  <span className="text-3xl">{mode.emoji}</span>
                  <span>
                    <span className="block font-semibold text-zinc-100">
                      {mode.label}
                    </span>
                    <span className="mt-1 block text-xs text-zinc-400">
                      {mode.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
          <button
            type="button"
            disabled={pending}
            onClick={continueFromPath}
            className={`mt-8 w-full py-2.5 text-sm font-medium disabled:opacity-50 ${filledNavBtn.fuchsia}`}
          >
            Continue as {pathMeta.label}
          </button>
        </section>
      )}

      {step === 1 && path === "predict" && (
        <section className="mt-10">
          <h1 className="text-2xl font-semibold">What topics interest you?</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Pick at least one — we&apos;ll surface markets you&apos;ll care about.
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
            className={`mt-8 w-full py-2.5 text-sm font-medium disabled:opacity-50 ${filledNavBtn.fuchsia}`}
          >
            Continue
          </button>
          <button
            type="button"
            onClick={skipInterests}
            className="mt-3 w-full text-xs text-zinc-500 hover:text-zinc-300"
          >
            Skip categories
          </button>
        </section>
      )}

      {step === 1 && path === "compete" && (
        <section className="mt-10">
          <h1 className="text-2xl font-semibold">Pick a duel style</h1>
          <p className="mt-2 text-sm text-zinc-400">{pathMeta.onboardingBlurb}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              { href: "/games/duels/rps", label: "Rock Paper Scissors", sub: "Instant luck" },
              { href: "/games/duels/chess", label: "Chess", sub: "Skill + ELO" },
              { href: "/games/duels/trivia", label: "Trivia Blitz", sub: "Knowledge" },
              { href: "/games/create", label: "Create duel", sub: "Custom stake" },
            ].map((g) => (
              <Link
                key={g.href}
                href={g.href}
                className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-4 text-sm hover:bg-violet-500/15"
              >
                <div className="font-medium text-violet-100">{g.label}</div>
                <div className="mt-1 text-xs text-zinc-500">{g.sub}</div>
              </Link>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStep(2)}
            className={`mt-8 w-full py-2.5 text-sm font-medium ${filledNavBtn.violet}`}
          >
            Continue
          </button>
        </section>
      )}

      {step === 1 && path === "watch" && (
        <section className="mt-10">
          <h1 className="text-2xl font-semibold">How do you want to watch?</h1>
          <p className="mt-2 text-sm text-zinc-400">{pathMeta.onboardingBlurb}</p>
          <div className="mt-6 space-y-3">
            <Link
              href="/games"
              className="block rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 hover:bg-emerald-500/15"
            >
              <div className="font-medium text-emerald-100">Live Arena</div>
              <p className="mt-1 text-xs text-zinc-400">
                BTC / ETH / SOL Up-Down windows with live timers
              </p>
            </Link>
            <Link
              href="/live"
              className="block rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-4 hover:bg-fuchsia-500/15"
            >
              <div className="font-medium text-fuchsia-100">Stream + bet</div>
              <p className="mt-1 text-xs text-zinc-400">
                Watch an event together and bet on outcomes
              </p>
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setStep(2)}
            className={`mt-8 w-full py-2.5 text-sm font-medium ${filledNavBtn.emerald}`}
          >
            Continue
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="mt-10">
          <h1 className="text-2xl font-semibold">How {pathMeta.label} works</h1>
          <ol className="mt-6 space-y-4 text-sm text-zinc-300">
            {pathMeta.howItWorks.map((line, i) => (
              <li
                key={line}
                className="rounded-lg border border-white/5 bg-zinc-900/40 p-4"
              >
                <strong className="text-zinc-100">{i + 1}.</strong> {line}
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => setStep(3)}
            className={`mt-8 w-full py-2.5 text-sm font-medium ${filledNavBtn.fuchsia}`}
          >
            Got it — show me
          </button>
        </section>
      )}

      {step === 3 && (
        <section className="mt-10">
          <h1 className="text-2xl font-semibold">Your first move</h1>
          <p className="mt-2 text-sm text-zinc-400">
            This is the activation moment for {pathMeta.label.toLowerCase()} mode.
          </p>
          <Link
            href={firstActionHref}
            className={`mt-6 block rounded-xl p-5 text-center text-sm font-medium ${filledNavBtn.fuchsia}`}
          >
            {pathMeta.firstActionLabel} →
          </Link>
          <Link
            href={pathMeta.createHref}
            className="mt-3 block text-center text-xs text-zinc-500 hover:text-fuchsia-300"
          >
            Or create something new →
          </Link>
          <button
            type="button"
            onClick={() => setStep(4)}
            className="mt-4 w-full text-xs text-zinc-500 hover:text-zinc-300"
          >
            I&apos;m ready — finish setup
          </button>
        </section>
      )}

      {step === 4 && (
        <section className="mt-10 text-center">
          <p className="text-4xl">{pathMeta.emoji}</p>
          <h1 className="mt-4 text-2xl font-semibold">You&apos;re set for {pathMeta.label}</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Use the Predict / Compete / Watch bar anytime to switch lanes.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => finishOnboarding(false, path))}
            className={`mt-8 w-full py-2.5 text-sm font-medium disabled:opacity-50 ${filledNavBtn.fuchsia}`}
          >
            Enter Vibebet
          </button>
        </section>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => finishOnboarding(true, path))}
        className="mt-6 w-full text-xs text-zinc-600 hover:text-zinc-400"
      >
        Skip for now
      </button>

      {step > 0 && (
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="mt-2 w-full text-xs text-zinc-600 hover:text-zinc-400"
        >
          ← Back
        </button>
      )}
    </div>
  );
}
