"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">Something went sideways.</h1>
      <p className="mt-2 text-sm text-zinc-400">
        {process.env.NODE_ENV === "production"
          ? "We're looking into it."
          : error.message}
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-zinc-500">
          Error ID: <code className="font-mono">{error.digest}</code>
        </p>
      )}
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-fuchsia-500 px-4 py-2 text-sm font-medium text-white hover:bg-fuchsia-400"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-white/10 px-4 py-2 text-sm text-zinc-200 hover:border-white/20"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
