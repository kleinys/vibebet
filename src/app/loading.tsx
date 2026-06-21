export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="space-y-3">
        <div className="h-8 w-1/2 animate-pulse rounded bg-zinc-800/60" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-800/40" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="h-24 animate-pulse rounded-xl bg-zinc-900/50" />
          <div className="h-24 animate-pulse rounded-xl bg-zinc-900/50" />
        </div>
      </div>
    </div>
  );
}
