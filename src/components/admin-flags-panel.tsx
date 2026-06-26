"use client";

import { useMemo, useState, useActionState } from "react";
import {
  bulkEnableFlagsForm,
  syncMissingFeatureFlagsForm,
  type ResolveState,
} from "@/app/admin/actions";
import { FlagToggle } from "@/components/flag-toggle";
import {
  FEATURE_FLAG_CATALOG,
  FEATURE_FLAG_KEYS,
} from "@/lib/feature-flag-catalog";

export function AdminFlagsPanel({
  flags,
}: {
  flags: Record<string, boolean>;
}) {
  const [query, setQuery] = useState("");

  const catalogKeys = useMemo(
    () => new Set(FEATURE_FLAG_CATALOG.map((f) => f.key)),
    [],
  );

  const missingFromDb = useMemo(
    () => FEATURE_FLAG_CATALOG.filter((f) => flags[f.key] === undefined),
    [flags],
  );

  const orphanInDb = useMemo(
    () =>
      Object.keys(flags).filter(
        (k) => !catalogKeys.has(k) && !FEATURE_FLAG_KEYS.has(k),
      ),
    [flags, catalogKeys],
  );

  const rows = useMemo(() => {
    const merged = new Map<string, { key: string; enabled: boolean; description?: string }>();

    for (const def of FEATURE_FLAG_CATALOG) {
      merged.set(def.key, {
        key: def.key,
        enabled: flags[def.key] ?? false,
        description: def.description,
      });
    }

    for (const [key, enabled] of Object.entries(flags)) {
      if (!merged.has(key)) {
        merged.set(key, { key, enabled, description: "(legacy / not in catalog)" });
      }
    }

    const q = query.trim().toLowerCase();
    return [...merged.values()]
      .filter(
        (r) =>
          !q ||
          r.key.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q),
      )
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [flags, query]);

  const enabledCount = rows.filter((r) => r.enabled).length;

  const [syncState, syncAction, syncPending] = useActionState<
    ResolveState,
    FormData
  >(syncMissingFeatureFlagsForm, null);

  const [bulkState, bulkAction, bulkPending] = useActionState<
    ResolveState,
    FormData
  >(bulkEnableFlagsForm, null);

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Feature flags
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            {enabledCount} enabled · {rows.length} total
            {missingFromDb.length > 0 && (
              <span className="ml-2 text-amber-400">
                · {missingFromDb.length} missing from DB (e.g. weekly_digest)
              </span>
            )}
          </p>
        </div>
        <input
          type="search"
          placeholder="Search flags…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="rounded-md border border-white/10 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200"
        />
      </div>

      {(missingFromDb.length > 0 || syncState?.ok) && (
        <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-100">
          {missingFromDb.length > 0 ? (
            <p>
              Some pages stay &quot;off&quot; because their flag row was never inserted
              (migration not run). Missing:{" "}
              <span className="font-mono text-amber-200">
                {missingFromDb.map((f) => f.key).join(", ")}
              </span>
            </p>
          ) : null}
          <form action={syncAction} className="mt-2 inline-block">
            <button
              type="submit"
              disabled={syncPending}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
            >
              {syncPending ? "Syncing…" : "Sync missing flags"}
            </button>
          </form>
          {syncState?.ok && (
            <p className="mt-2 text-emerald-300">{syncState.ok}</p>
          )}
          {syncState?.error && (
            <p className="mt-2 text-red-300">{syncState.error}</p>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <form action={bulkAction}>
          <button
            type="submit"
            disabled={bulkPending}
            className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
          >
            {bulkPending ? "Enabling…" : "Enable all (except real money & cashout)"}
          </button>
        </form>
        {bulkState?.ok && (
          <span className="self-center text-xs text-emerald-300">{bulkState.ok}</span>
        )}
        {bulkState?.error && (
          <span className="self-center text-xs text-red-300">{bulkState.error}</span>
        )}
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-white/5">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/60 text-left text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">Key</th>
              <th className="hidden px-4 py-2 font-medium sm:table-cell">Description</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((row) => (
              <tr key={row.key} className={flags[row.key] === undefined ? "bg-amber-500/5" : undefined}>
                <td className="px-4 py-2 font-mono text-xs">{row.key}</td>
                <td className="hidden px-4 py-2 text-xs text-zinc-500 sm:table-cell">
                  {row.description}
                </td>
                <td className="px-4 py-2">
                  {flags[row.key] === undefined ? (
                    <span className="text-xs text-amber-400">missing — sync above</span>
                  ) : (
                    <FlagToggle flagKey={row.key} enabled={row.enabled} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {orphanInDb.length > 0 && (
        <p className="mt-2 text-[10px] text-zinc-600">
          Legacy DB-only flags: {orphanInDb.join(", ")}
        </p>
      )}

      <p className="mt-3 text-xs text-zinc-500">
        Flags are cached ~60s on pages. After toggling, refresh the target page.
        Keep <code className="font-mono">real_money_enabled</code> and{" "}
        <code className="font-mono">gems_cashout_enabled</code> off until licensed.
      </p>
    </section>
  );
}
