import Link from "next/link";
import { listNotifications, notificationHref } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";
import { markNotificationsRead } from "@/app/account/notifications/actions";

export const revalidate = 0;

/**
 * Server component header + dropdown trigger.
 *
 * The dropdown itself is a CSS-only `<details>` element — no client JS needed
 * for the open/close. The "Mark all read" button is a form post that
 * revalidates the page.
 */
export async function NotificationBell() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let unreadCount = 0;
  let recent: Awaited<ReturnType<typeof listNotifications>> = [];
  try {
    [unreadCount, recent] = await Promise.all([
      (async () => {
        const { data } = await supabase.rpc("unread_notification_count");
        return typeof data === "number" ? data : 0;
      })(),
      listNotifications({ limit: 8 }),
    ]);
  } catch {
    // Notifications offline → render the bell with zero, not a crash.
  }

  return (
    <details className="group relative">
      <summary
        className="list-none cursor-pointer rounded-md p-1.5 text-zinc-300 hover:bg-zinc-800/60 hover:text-white"
        aria-label={`Notifications${unreadCount > 0 ? `: ${unreadCount} unread` : ""}`}
      >
        <div className="relative grid h-5 w-5 place-items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-5 w-5"
            aria-hidden
          >
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM8 16a2 2 0 104 0H8z" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-fuchsia-500 px-1 text-[10px] font-medium text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
      </summary>

      <div className="absolute right-0 z-50 mt-2 w-80 origin-top-right rounded-lg border border-white/10 bg-zinc-950 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Notifications
          </span>
          {unreadCount > 0 && (
            <form action={markNotificationsRead}>
              <input type="hidden" name="ids" value="" />
              <button
                type="submit"
                className="text-[11px] text-fuchsia-400 hover:text-fuchsia-300"
              >
                Mark all read
              </button>
            </form>
          )}
        </div>

        {recent.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-zinc-500">
            No notifications yet.
          </p>
        ) : (
          <ul className="max-h-96 divide-y divide-white/5 overflow-y-auto">
            {recent.map((n) => (
              <li key={n.id}>
                <Link
                  href={notificationHref(n)}
                  className={`block px-3 py-2 transition hover:bg-zinc-900 ${
                    n.is_read ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && (
                      <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-fuchsia-400" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-100">
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="truncate text-xs text-zinc-400">
                          {n.body}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-zinc-500">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-white/5 px-3 py-2 text-center">
          <Link
            href="/account/notifications"
            className="text-[11px] text-zinc-400 hover:text-zinc-200"
          >
            View all →
          </Link>
        </div>
      </div>
    </details>
  );
}
