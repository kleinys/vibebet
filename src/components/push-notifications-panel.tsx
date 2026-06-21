"use client";

import { useEffect, useState, useTransition } from "react";
import {
  disablePushNotifications,
  savePushSubscription,
} from "@/app/account/notifications/push-actions";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function PushNotificationsPanel({
  vapidPublicKey,
  pushEnabled,
  profilePushEnabled,
}: {
  vapidPublicKey: string | null;
  pushEnabled: boolean;
  profilePushEnabled: boolean;
}) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window,
    );
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  async function registerServiceWorker() {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    return reg;
  }

  async function enablePush() {
    if (!vapidPublicKey) {
      setMessage("VAPID keys not configured on the server.");
      return;
    }

    setMessage(null);
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== "granted") {
      setMessage("Notification permission denied.");
      return;
    }

    const reg = await registerServiceWorker();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }

    startTransition(async () => {
      const result = await savePushSubscription(
        sub!.toJSON(),
        navigator.userAgent,
      );
      if (result.error) setMessage(result.error);
      else {
        setMessage(result.ok ?? "Enabled.");
        await fetch("/api/push/deliver", { method: "POST" });
      }
    });
  }

  async function disablePush() {
    setMessage(null);
    startTransition(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      const result = await disablePushNotifications();
      setMessage(result.error ?? result.ok ?? "Disabled.");
      setPermission(Notification.permission);
    });
  }

  if (!pushEnabled) return null;

  return (
    <section className="mt-8 rounded-xl border border-violet-500/25 bg-violet-500/5 p-5">
      <h3 className="text-sm font-semibold text-violet-100">Browser push</h3>
      <p className="mt-1 text-xs text-zinc-400">
        Get alerts when markets resolve, duels finish, or someone comments on
        your market — even when Vibebet isn&apos;t open.
      </p>

      {!supported && (
        <p className="mt-3 text-xs text-amber-300">
          Push isn&apos;t supported in this browser. Try Chrome or Safari on
          mobile after adding Vibebet to your home screen.
        </p>
      )}

      {supported && !vapidPublicKey && (
        <p className="mt-3 text-xs text-amber-300">
          Server VAPID keys missing — add{" "}
          <code className="rounded bg-zinc-900 px-1">NEXT_PUBLIC_VAPID_PUBLIC_KEY</code>{" "}
          and <code className="rounded bg-zinc-900 px-1">VAPID_PRIVATE_KEY</code>{" "}
          to <code className="rounded bg-zinc-900 px-1">.env.local</code>.
        </p>
      )}

      {supported && vapidPublicKey && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || permission === "granted"}
            onClick={() => void enablePush()}
            className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {pending ? "Enabling…" : permission === "granted" ? "Enabled on device" : "Enable push"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void disablePush()}
            className="rounded-md border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:border-white/20"
          >
            Turn off
          </button>
        </div>
      )}

      {message && <p className="mt-3 text-xs text-zinc-400">{message}</p>}
      {permission === "granted" && profilePushEnabled && (
        <p className="mt-2 text-[11px] text-emerald-300/80">
          Push active on this account.
        </p>
      )}
    </section>
  );
}
