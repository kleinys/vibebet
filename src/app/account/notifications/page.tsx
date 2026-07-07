import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listNotifications, notificationHref } from "@/lib/notifications";
import { markNotificationsRead } from "./actions";
import { AccountNav } from "@/components/account-nav";
import { PushNotificationsPanel } from "@/components/push-notifications-panel";
import { isEnabled } from "@/lib/feature-flags";

export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ filter?: string }>;
}

export default async function NotificationsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/notifications");

  const params = await searchParams;
  const unreadOnly = params.filter === "unread";

  const notifications = await listNotifications({
    limit: 100,
    unreadOnly,
  });

  const pushFlagOn = await isEnabled("push_notifications_enabled");
  const { data: profile } = await supabase
    .from("profiles")
    .select("push_notifications_enabled")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Account</h1>
      <AccountNav active="/account/notifications" />

      <header className="mt-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Notifications
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Resolved markets, comments on your markets, court events, and
            more.
          </p>
        </div>
        <form action={markNotificationsRead}>
          <input type="hidden" name="ids" value="" />
          <button
            type="submit"
            className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:border-white/20 hover:text-white"
          >
            Mark all read
          </button>
        </form>
      </header>

      <div className="mt-4 flex items-center gap-1 text-xs">
        <FilterTab href="/account/notifications" active={!unreadOnly} label="All" />
        <FilterTab
          href="/account/notifications?filter=unread"
          active={unreadOnly}
          label="Unread"
        />
      </div>

      <PushNotificationsPanel
        vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
        pushEnabled={pushFlagOn}
        profilePushEnabled={Boolean(profile?.push_notifications_enabled)}
      />

      {notifications.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
          {unreadOnly
            ? "Nothing unread."
            : "No notifications yet. They'll appear here when one of your markets resolves or someone interacts with your content."}
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-white/5 overflow-hidden rounded-lg border border-white/5">
          {notifications.map((n) => (
            <li key={n.id} className={n.is_read ? "bg-zinc-950/40" : "bg-zinc-900/40"}>
              <Link
                href={notificationHref(n) as any}  // Type assertion to fix TS error
                className="block px-4 py-3 transition hover:bg-zinc-900"
              >
                <div className="flex items-start gap-3">
                  {!n.is_read && (
                    <span className="mt-2 inline-block h-2 w-2 shrink-0 rounded-full bg-fuchsia-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-100">{n.title}</p>
                    {n.body && (
                      <p className="mt-0.5 text-sm text-zinc-400">{n.body}</p>
                    )}
                    <p className="mt-1 text-[11px] text-zinc-500">
                      <KindBadge kind={n.kind} /> ·{" "}
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterTab({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-md bg-zinc-800 px-2.5 py-1 text-zinc-100"
          : "rounded-md px-2.5 py-1 text-zinc-400 hover:text-zinc-200"
      }
    >
      {label}
    </Link>
  );
}

function KindBadge({ kind }: { kind: string }) {
  const styles: Record<string, string> = {
    bet_won: "bg-emerald-500/10 text-emerald-300",
    bet_lost: "bg-rose-500/10 text-rose-300",
    market_resolved: "bg-zinc-700/40 text-zinc-300",
    market_commented: "bg-fuchsia-500/10 text-fuchsia-300",
    comment_reply: "bg-fuchsia-500/10 text-fuchsia-300",
    streak_at_risk: "bg-amber-500/10 text-amber-300",
    resolution_proposed: "bg-blue-500/10 text-blue-300",
    dispute_opened: "bg-amber-500/10 text-amber-300",
    dispute_resolved: "bg-amber-500/10 text-amber-300",
  };
  const labels: Record<string, string> = {
    bet_won: "Won",
    bet_lost: "Lost",
    market_resolved: "Resolved",
    market_commented: "Comment",
    comment_reply: "Reply",
    streak_at_risk: "Streak",
    resolution_proposed: "Proposed",
    dispute_opened: "Dispute",
    dispute_resolved: "Court",
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
        styles[kind] ?? "bg-zinc-700/40 text-zinc-300"
      }`}
    >
      {labels[kind] ?? kind}
    </span>
  );
}