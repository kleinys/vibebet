"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { FriendChallengeFields } from "@/components/friend-challenge-fields";
import {
  acceptTriviaDuel,
  cancelTriviaDuel,
  createTriviaDuel,
} from "./lightning-actions";

type OpenTrivia = {
  id: string;
  creator_id: string;
  creator_name: string;
  stake: number;
  is_friendly?: boolean;
  invited_user_id?: string | null;
};

export function TriviaDuelPanel({
  openDuels,
  userId,
}: {
  openDuels: OpenTrivia[];
  userId: string;
}) {
  const [createState, createAction, createPending] = useActionState(createTriviaDuel, null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <form
        action={createAction}
        className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5"
      >
        <h2 className="text-sm font-semibold text-cyan-100">Post Trivia duel</h2>
        <p className="mt-1 text-xs text-zinc-400">
          5 quick questions. Most correct wins 90% of the pool. Same questions for both players.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            name="stake"
            type="number"
            min={10}
            max={10000}
            defaultValue={75}
            className="w-24 rounded-md border border-white/10 bg-zinc-900 px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={createPending}
            className="rounded-md bg-cyan-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            {createPending ? "Posting…" : "Post duel"}
          </button>
        </div>
        <FriendChallengeFields stakeInputName="stake" />
        {createState?.error && <p className="mt-2 text-xs text-rose-300">{createState.error}</p>}
        {createState?.ok && <p className="mt-2 text-xs text-emerald-300">{createState.ok}</p>}
      </form>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Open challenges
        </h3>
        {openDuels.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-500">No open duels — post one above.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {openDuels.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-zinc-900/40 p-3 text-sm"
              >
                <span>
                  {d.creator_name}
                  {d.is_friendly ? (
                    <span className="ml-2 text-[10px] text-sky-400">friendly · free</span>
                  ) : (
                    <> · {d.stake} VIBE</>
                  )}
                </span>
                {d.creator_id !== userId ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await acceptTriviaDuel(d.id);
                        if (r?.error) toast.error(r.error);
                        else if (r?.redirect) window.location.href = r.redirect;
                      })
                    }
                    className="rounded-md bg-cyan-600 px-3 py-1 text-xs text-white hover:bg-cyan-500"
                  >
                    Accept &amp; play
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await cancelTriviaDuel(d.id);
                        if (r.error) toast.error(r.error);
                        else toast.success("Cancelled");
                      })
                    }
                    className="text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    Cancel
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function TriviaPlayForm({
  duelId,
  questions,
  alreadySubmitted,
}: {
  duelId: string;
  questions: { question_id: string; question: string; options: string[]; question_num: number }[];
  alreadySubmitted: boolean;
}) {
  const [answers, setAnswers] = useState<(number | null)[]>([null, null, null, null, null]);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  if (alreadySubmitted && !result) {
    return (
      <p className="rounded-lg border border-white/10 bg-zinc-900/40 p-4 text-sm text-zinc-400">
        Answers submitted — waiting for your opponent…
      </p>
    );
  }

  if (result) {
    return <p className="text-sm text-emerald-300">{result}</p>;
  }

  const allAnswered = answers.every((a) => a !== null);

  return (
    <div className="space-y-6">
      {questions.map((q, qi) => (
        <fieldset key={q.question_id} className="rounded-lg border border-white/5 p-4">
          <legend className="text-sm font-medium text-zinc-200">
            {qi + 1}. {q.question}
          </legend>
          <div className="mt-3 space-y-2">
            {q.options.map((opt, oi) => (
              <label key={oi} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                <input
                  type="radio"
                  name={`q-${qi}`}
                  checked={answers[qi] === oi}
                  onChange={() => {
                    const next = [...answers];
                    next[qi] = oi;
                    setAnswers(next);
                  }}
                />
                {opt}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <button
        type="button"
        disabled={!allAnswered || pending}
        onClick={() =>
          startTransition(async () => {
            const { submitTriviaAnswers } = await import("./lightning-actions");
            const r = await submitTriviaAnswers(
              duelId,
              answers as number[],
            );
            if (r.error) toast.error(r.error);
            else {
              setResult(r.ok ?? "Submitted!");
              if (r.settled) toast.success(r.ok);
            }
          })
        }
        className="rounded-md bg-cyan-600 px-5 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Submit answers"}
      </button>
    </div>
  );
}
