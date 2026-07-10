import type { HustleOracleProfile } from "@/lib/hustle-oracle";

export function HustleTrustBar({ oracle }: { oracle: HustleOracleProfile }) {
  const pct = Math.round((oracle.trust_score / 1000) * 100);

  return (
    <div className="hustle-trust-bar">
      <div className="hustle-trust-bar__header">
        <div>
          <p className="hustle-trust-bar__label">Oracle Passport</p>
          <p className="hustle-trust-bar__score tabular-nums">
            Trust {oracle.trust_score}
            <span className="text-zinc-500"> / 1000</span>
          </p>
        </div>
        <div className="hustle-trust-bar__tier">
          <span className="hustle-trust-bar__tier-badge">{oracle.tier_label}</span>
          <span className="text-[10px] text-zinc-500">Tier {oracle.hustle_tier}</span>
        </div>
      </div>

      <div className="hustle-trust-bar__track" aria-hidden>
        <div className="hustle-trust-bar__fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="hustle-trust-bar__meta">
        <span>Fee {oracle.platform_fee_pct}%</span>
        <span>Streak {oracle.current_streak}d</span>
        <span>{oracle.spark_claims_lifetime} Spark claims</span>
      </div>

      {oracle.next_tier_label && oracle.next_tier_spark_target != null && (
        <p className="hustle-trust-bar__next">
          Unlock <strong>{oracle.next_tier_label}</strong>:{" "}
          {oracle.next_tier_spark_progress ?? 0}/{oracle.next_tier_spark_target} Spark claims
          {oracle.next_tier_trust_gate != null && (
            <> or Trust {oracle.next_tier_trust_gate}+</>
          )}
        </p>
      )}
    </div>
  );
}
