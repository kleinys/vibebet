import Link from "next/link";

export default function MarketNotFound() {
  return (
    <div className="mx-auto max-w-md px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">Market not found</h1>
      <p className="mt-2 text-sm text-zinc-400">
        It may have been deleted, or the link is wrong.
      </p>
      <Link
        href="/markets"
        className="mt-6 inline-block rounded-md bg-fuchsia-500 px-4 py-2 text-sm font-medium text-white hover:bg-fuchsia-400"
      >
        Back to markets
      </Link>
    </div>
  );
}
