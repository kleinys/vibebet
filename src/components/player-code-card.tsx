import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function PlayerCodeCard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.rpc("get_my_player_code");
  const row = Array.isArray(data) ? data[0] : null;
  if (!row?.referral_code) return null;

  return (
    <section className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-violet-300">
        Your player code
      </h2>
      <p className="mt-2 font-mono text-lg text-zinc-100">{row.referral_code}</p>
      {row.username && (
        <p className="mt-1 text-xs text-zinc-500">
          Or challenge by username: <span className="text-zinc-300">@{row.username}</span>
        </p>
      )}
      <p className="mt-2 text-xs text-zinc-500">
        Friends enter this when posting a duel to challenge you directly. Also on{" "}
        <Link href="/invite" className="text-fuchsia-400 hover:underline">
          Invite page
        </Link>
        .
      </p>
    </section>
  );
}
