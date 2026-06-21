import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { TriviaPlayForm } from "../../trivia-panels";

export const revalidate = 0;

export default async function TriviaDuelPlayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const enabled = await isEnabled("trivia_enabled");
  if (!enabled) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: duelRow } = await supabase
    .from("trivia_duels")
    .select("id, creator_id, opponent_id, status, creator_answers, opponent_answers, creator_score, opponent_score, winner_id, stake")
    .eq("id", id)
    .maybeSingle();

  if (!duelRow || duelRow.status === "open") notFound();
  if (duelRow.creator_id !== user.id && duelRow.opponent_id !== user.id) notFound();

  const { data: qRows } = await supabase.rpc("get_trivia_questions_for_duel", {
    p_duel_id: id,
  });

  const questions = (qRows ?? []).map((q: { question_id: string; question: string; options: unknown; question_num: number }) => ({
    question_id: q.question_id,
    question: q.question,
    options: Array.isArray(q.options) ? (q.options as string[]) : JSON.parse(String(q.options)),
    question_num: q.question_num,
  }));

  const isCreator = user.id === duelRow.creator_id;
  const alreadySubmitted = isCreator
    ? duelRow.creator_answers != null
    : duelRow.opponent_answers != null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/games/duels/trivia" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Trivia duels
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Trivia Blitz</h1>
      <p className="mt-1 text-sm text-zinc-400">{duelRow.stake} VIBE · {questions.length} questions</p>

      {duelRow.status === "settled" ? (
        <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-sm">
          <p className="text-emerald-200">
            Final score: {duelRow.creator_score} — {duelRow.opponent_score}
          </p>
          <p className="mt-2 text-zinc-400">
            {duelRow.winner_id
              ? duelRow.winner_id === user.id
                ? "You won!"
                : "You lost."
              : "Draw — stakes refunded."}
          </p>
        </div>
      ) : (
        <div className="mt-6">
          <TriviaPlayForm
            duelId={id}
            questions={questions}
            alreadySubmitted={alreadySubmitted}
          />
        </div>
      )}
    </div>
  );
}
