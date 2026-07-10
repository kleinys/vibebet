"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { toast } from "sonner";
import { claimHustleReward } from "@/app/play/actions";
import type { DailyHustleTask } from "@/lib/hustle/shared";
import type { HustleOracleProfile } from "@/lib/hustle/shared";
import { formatVibe } from "@/lib/utils";
import { CurrencyIconVibe } from "@/components/fantasy-icons";
import { SparkTagPanel } from "@/components/hustle/spark-tag-panel";
import { SparkWritePanel } from "@/components/hustle/spark-write-panel";
import { SparkSharePanel } from "@/components/hustle/spark-share-panel";
import { SparkCaptionPanel } from "@/components/hustle/spark-caption-panel";
import { HustleTrustBar } from "@/components/hustle/hustle-trust-bar";
import { HustleTierLadder } from "@/components/hustle/hustle-tier-ladder";
import { HustleWalletPanel } from "@/components/hustle/hustle-wallet-panel";
import { HustleGigBoard } from "@/components/hustle/hustle-gig-board";
import { HustleSharesPanel } from "@/components/hustle/hustle-shares-panel";
import { HustleGovernancePanel } from "@/components/hustle/hustle-governance-panel";
import { HustleWellnessPanel } from "@/components/hustle/hustle-wellness-panel";
import type {
  HustleEquityState,
  HustleGovernanceState,
  HustleMarketplaceState,
  HustleWalletState,
  HustleWellnessState,
} from "@/lib/hustle/shared";

export function HustleSparkBoard({
  sparkTasks,
  flashTasks,
  dailyTasks,
  vibeBalance,
  oracle,
  trustEnabled,
  bridgeEnabled,
  marketplaceEnabled,
  sharesEnabled,
  governanceEnabled,
  recoveryEnabled,
  wallet,
  marketplace,
  equity,
  governance,
  wellness,
}: {
  sparkTasks: DailyHustleTask[];
  flashTasks: DailyHustleTask[];
  dailyTasks: DailyHustleTask[];
  vibeBalance: number;
  oracle: HustleOracleProfile | null;
  trustEnabled: boolean;
  bridgeEnabled: boolean;
  marketplaceEnabled: boolean;
  sharesEnabled: boolean;
  governanceEnabled: boolean;
  recoveryEnabled: boolean;
  wallet: HustleWalletState | null;
  marketplace: HustleMarketplaceState | null;
  equity: HustleEquityState | null;
  governance: HustleGovernanceState | null;
  wellness: HustleWellnessState | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [celebrateId, setCelebrateId] = useState<string | null>(null);
  const tierRef = useRef(oracle?.hustle_tier ?? 1);

  useEffect(() => {
    if (oracle) tierRef.current = oracle.hustle_tier;
  }, [oracle]);

  const allTasks = [...sparkTasks, ...flashTasks, ...dailyTasks];
  const claimable = allTasks.filter((t) => t.completed && !t.claimed && !t.tier_locked);
  const claimableTotal = claimable.reduce((n, t) => n + t.reward_vibe, 0);

  function refresh() {
    router.refresh();
  }

  function claim(taskId: string) {
    startTransition(async () => {
      const prevTier = tierRef.current;
      const result = await claimHustleReward(taskId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setCelebrateId(taskId);
      let message = bridgeEnabled
        ? `+${formatVibe(result.amount ?? 0)} Hustle Cash claimed!`
        : `+${formatVibe(result.amount ?? 0)} VIBE claimed!`;
      if (result.tier_label && result.hustle_tier && result.hustle_tier > prevTier) {
        message += ` · ${result.tier_label} tier unlocked!`;
        tierRef.current = result.hustle_tier;
      }
      toast.success(message);
      window.setTimeout(() => setCelebrateId(null), 1200);
      refresh();
    });
  }

  const tierLabel = oracle?.tier_label ?? "Spark";

  const displayPlayBalance = bridgeEnabled && wallet ? wallet.play_balance : vibeBalance;
  const displayHustleCash = bridgeEnabled && wallet ? wallet.hustle_cash : 0;
  const lowPlayBalance =
    bridgeEnabled && wallet
      ? wallet.play_balance < 100 && wallet.hustle_cash >= 50
      : vibeBalance < 100;

  return (
    <div className="hustle-spark-board">
      <div className="hustle-spark-board__hero">
        <div>
          <p className="hustle-spark-board__eyebrow">HustleOS · {tierLabel} tier</p>
          <h2 className="hustle-spark-board__title">Earn VIBE in minutes</h2>
          <p className="hustle-spark-board__sub">
            Complete micro-tasks, grow Trust Score, unlock higher tiers. Resets midnight UTC.
            {bridgeEnabled && " Claims go to Hustle Cash — bridge to Play when ready."}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {bridgeEnabled && wallet ? (
            <>
              <div className="hustle-spark-board__balance hustle-spark-board__balance--earn">
                <CurrencyIconVibe className="h-4 w-4 text-amber-300" />
                <span className="tabular-nums font-semibold">{formatVibe(displayHustleCash)}</span>
                <span className="text-[10px] text-amber-200/80">Hustle Cash</span>
              </div>
              <div className="hustle-spark-board__balance">
                <CurrencyIconVibe className="h-4 w-4 text-violet-300" />
                <span className="tabular-nums font-semibold">{formatVibe(displayPlayBalance)}</span>
                <span className="text-[10px] text-violet-200/80">Play</span>
              </div>
            </>
          ) : (
            <div className="hustle-spark-board__balance">
              <CurrencyIconVibe className="h-4 w-4 text-amber-300" />
              <span className="tabular-nums font-semibold">{formatVibe(vibeBalance)}</span>
            </div>
          )}
        </div>
      </div>

      {bridgeEnabled && wallet && (
        <div className="mb-4">
          <HustleWalletPanel
            wallet={wallet}
            blocksPlayBridge={wellness?.blocks_play_bridge}
            recoveryUntil={wellness?.recovery_until}
            onUpdate={refresh}
          />
        </div>
      )}

      {marketplaceEnabled && marketplace && (
        <div className="mb-8">
          <HustleGigBoard
            marketplace={marketplace}
            hustleTier={oracle?.hustle_tier ?? marketplace.hustle_tier}
            onUpdate={refresh}
          />
        </div>
      )}

      {sharesEnabled && equity && (
        <div className="mb-8">
          <HustleSharesPanel equity={equity} onUpdate={refresh} />
        </div>
      )}

      {governanceEnabled && governance && (
        <div className="mb-8">
          <HustleGovernancePanel governance={governance} onUpdate={refresh} />
        </div>
      )}

      {trustEnabled && oracle && (
        <div className="mb-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <HustleTrustBar oracle={oracle} />
          <HustleTierLadder oracle={oracle} />
        </div>
      )}

      {claimableTotal > 0 && (
        <p className="hustle-spark-board__claim-hint">
          {formatVibe(claimableTotal)} {bridgeEnabled ? "Hustle Cash" : "VIBE"} ready to claim below
        </p>
      )}

      {lowPlayBalance && (
        <div className="hustle-spark-board__banner hustle-spark-board__banner--earn">
          {bridgeEnabled
            ? "Low play balance — claim tasks or bridge Hustle Cash → Play (min 50 VIBE)."
            : "Low balance — finish a Spark task to top up fast."}
        </div>
      )}

      <section>
        <h3 className="hustle-spark-board__section-title">Spark tasks</h3>
        <ul className="hustle-spark-board__list">
          {sparkTasks.map((task) => (
            <TaskCard
              key={task.task_id}
              task={task}
              celebrating={celebrateId === task.task_id}
              pending={pending}
              bridgeEnabled={bridgeEnabled}
              onClaim={() => claim(task.task_id)}
              onProgress={refresh}
            />
          ))}
        </ul>
      </section>

      {flashTasks.length > 0 && (
        <section className="mt-8">
          <h3 className="hustle-spark-board__section-title">Flash tasks</h3>
          <p className="mb-3 text-[11px] text-zinc-500">
            Unlock at 20 Spark claims or Trust 550+.
          </p>
          <ul className="hustle-spark-board__list">
            {flashTasks.map((task) => (
              <TaskCard
                key={task.task_id}
                task={task}
                celebrating={celebrateId === task.task_id}
                pending={pending}
                bridgeEnabled={bridgeEnabled}
                onClaim={() => claim(task.task_id)}
                onProgress={refresh}
              />
            ))}
          </ul>
        </section>
      )}

      {dailyTasks.length > 0 && (
        <section className="mt-8">
          <h3 className="hustle-spark-board__section-title">Daily earn-back</h3>
          <ul className="hustle-spark-board__list">
            {dailyTasks.map((task) => (
              <TaskCard
                key={task.task_id}
                task={task}
                celebrating={celebrateId === task.task_id}
                pending={pending}
                bridgeEnabled={bridgeEnabled}
                onClaim={() => claim(task.task_id)}
                onProgress={refresh}
              />
            ))}
          </ul>
        </section>
      )}

      {recoveryEnabled && wellness && (
        <div className="mt-8">
          <HustleWellnessPanel wellness={wellness} onUpdate={refresh} />
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task,
  celebrating,
  pending,
  bridgeEnabled,
  onClaim,
  onProgress,
}: {
  task: DailyHustleTask;
  celebrating: boolean;
  pending: boolean;
  bridgeEnabled: boolean;
  onClaim: () => void;
  onProgress: () => void;
}) {
  const pct = task.tier_locked
    ? 0
    : Math.min(100, Math.round((task.progress / task.target) * 100));
  const interactive =
    task.metric === "platform_tag" ||
    task.metric === "platform_write" ||
    task.metric === "platform_share" ||
    task.metric === "platform_caption";

  return (
    <li
      className={`hustle-spark-board__card ${celebrating ? "hustle-spark-board__card--celebrate" : ""} ${task.tier_locked ? "hustle-spark-board__card--locked" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-zinc-100">{task.title}</p>
            {task.task_kind === "spark" && (
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-200">
                Spark
              </span>
            )}
            {task.task_kind === "flash" && (
              <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-200">
                Flash
              </span>
            )}
            {task.tier_locked && (
              <span className="rounded bg-zinc-700/50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-zinc-400">
                Tier {task.min_hustle_tier}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">{task.description}</p>
          <p className="mt-2 text-xs text-amber-200">
            +{formatVibe(task.reward_vibe)} {bridgeEnabled ? "Hustle Cash" : "VIBE"}
          </p>
        </div>
        <div className="text-right">
          <div
            className="hustle-spark-board__ring"
            style={{ "--pct": pct } as CSSProperties}
            aria-hidden
          >
            <span className="text-[10px] font-bold tabular-nums text-zinc-200">
              {task.tier_locked ? "—" : `${task.progress}/${task.target}`}
            </span>
          </div>
        </div>
      </div>

      {task.tier_locked && (
        <p className="mt-3 text-[10px] text-zinc-500">
          Reach tier {task.min_hustle_tier} to unlock this task.
        </p>
      )}

      {!task.tier_locked && interactive && !task.completed && task.metric === "platform_tag" && (
        <SparkTagPanel
          taskId={task.task_id}
          progress={task.progress}
          target={task.target}
          disabled={task.claimed}
          onProgress={onProgress}
        />
      )}
      {!task.tier_locked && interactive && !task.completed && task.metric === "platform_write" && (
        <SparkWritePanel
          taskId={task.task_id}
          progress={task.progress}
          target={task.target}
          disabled={task.claimed}
          onProgress={onProgress}
        />
      )}
      {!task.tier_locked && interactive && !task.completed && task.metric === "platform_share" && (
        <SparkSharePanel
          taskId={task.task_id}
          progress={task.progress}
          target={task.target}
          disabled={task.claimed}
          onProgress={onProgress}
        />
      )}
      {!task.tier_locked && interactive && !task.completed && task.metric === "platform_caption" && (
        <SparkCaptionPanel
          taskId={task.task_id}
          progress={task.progress}
          target={task.target}
          disabled={task.claimed}
          tierLocked={task.tier_locked}
          onProgress={onProgress}
        />
      )}

      {!task.tier_locked && !interactive && !task.completed && (
        <p className="mt-3 text-[10px] text-zinc-500">
          {task.metric === "bets" && "Place bets on markets, duels, or live windows."}
          {task.metric === "duel_wins" && "Win any skill duel or prediction duel today."}
          {task.metric === "login" && "Log in to progress automatically."}
          {task.metric === "comments" && "Comment on any market."}
          {task.metric === "court_votes" && "Vote in The Courtroom."}
        </p>
      )}

      {!task.tier_locked && task.completed && !task.claimed && (
        <button
          type="button"
          disabled={pending}
          onClick={onClaim}
          className="hustle-spark-board__claim-btn mt-3"
        >
          Claim {formatVibe(task.reward_vibe)} {bridgeEnabled ? "Hustle Cash" : "VIBE"}
        </button>
      )}

      {task.claimed && (
        <p className="mt-2 text-xs text-emerald-300">Claimed today ✓</p>
      )}
    </li>
  );
}
