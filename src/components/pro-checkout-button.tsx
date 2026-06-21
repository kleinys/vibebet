"use client";

import { useTransition } from "react";
import { startProCheckout } from "@/app/shop/actions";

export function ProCheckoutButton({ signedIn }: { signedIn: boolean }) {
  const [pending, start] = useTransition();

  if (!signedIn) {
    return (
      <a
        href="/login?next=/shop"
        className="inline-block rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
      >
        Sign in to subscribe
      </a>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => void startProCheckout())}
      className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
    >
      {pending ? "Redirecting…" : "Subscribe — $4.99/mo"}
    </button>
  );
}
