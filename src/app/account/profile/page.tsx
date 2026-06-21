import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountNav } from "@/components/account-nav";
import { ProfileForm } from "@/components/profile-form";
import { getEquippedCosmetic } from "@/lib/cosmetics";
import { UserAvatar } from "@/components/user-avatar";
import { getMyGuild } from "@/lib/guilds";
import { isEnabled } from "@/lib/feature-flags";

export const revalidate = 0;

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/profile");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username, created_at")
    .eq("id", user.id)
    .maybeSingle();

  const equipped = await getEquippedCosmetic(user.id).catch(() => null);
  const guildsOn = await isEnabled("guilds_enabled");
  const myGuild = guildsOn ? await getMyGuild().catch(() => null) : null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Account</h1>
      <AccountNav active="/account/profile" />

      <section className="mt-6 rounded-xl border border-white/5 bg-zinc-900/40 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Equipped look
        </h2>
        <div className="mt-3 flex items-center gap-3">
          <UserAvatar slug={equipped?.slug} size="md" />
          <div>
            <p className="text-sm font-medium text-zinc-100">
              {equipped?.name ?? "Default Oracle"}
            </p>
            <p className="text-xs text-zinc-500">
              {equipped
                ? "Visible in the header and on your profile."
                : "Equip a skin from the Shop to customize your avatar."}
            </p>
            {!equipped && (
              <Link
                href="/shop"
                className="mt-1 inline-block text-xs text-fuchsia-400 hover:underline"
              >
                Browse shop →
              </Link>
            )}
          </div>
        </div>
      </section>

      {myGuild && (
        <section className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-emerald-400/80">
            Guild
          </h2>
          <p className="mt-2 text-sm font-medium text-emerald-100">
            [{myGuild.tag}] {myGuild.name}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Role: {myGuild.role} ·{" "}
            <Link href={`/guilds/${myGuild.slug}`} className="text-emerald-300 hover:underline">
              View guild →
            </Link>
          </p>
        </section>
      )}

      <section className="mt-6 rounded-xl border border-white/5 bg-zinc-900/40 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Public profile
        </h2>
        <ProfileForm initial={profile?.display_name ?? ""} />
      </section>

      <section className="mt-6 rounded-xl border border-white/5 bg-zinc-900/40 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Account
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-zinc-500">Email</dt>
            <dd className="text-zinc-200">{user.email}</dd>
          </div>
          {profile?.username && (
            <div className="flex items-center justify-between">
              <dt className="text-zinc-500">Username</dt>
              <dd className="text-zinc-200">@{profile.username}</dd>
            </div>
          )}
          <div className="flex items-center justify-between">
            <dt className="text-zinc-500">Member since</dt>
            <dd className="text-zinc-200">
              {profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString()
                : "—"}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
