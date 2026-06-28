import Link from "next/link";
import type { CompanionInput, CompanionState } from "@/lib/vibe-companion";
import { computeCompanion } from "@/lib/vibe-companion";
import {
  figureLabels,
  resolveFigureConfig,
  type FigureConfig,
} from "@/lib/companion-figure";
import { CompanionFigure, CompanionFigureScene } from "@/components/companion-figure";

export function VibeCompanion({
  input,
  size = "sm",
  showLabel = false,
  title,
}: {
  input: CompanionInput;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  title?: string;
}) {
  const config = resolveFigureConfig(input);
  const labels = figureLabels(config);
  const svgSize = size === "lg" ? "lg" : size === "md" ? "md" : "sm";

  return (
    <span
      className="inline-flex flex-col items-center gap-0.5"
      title={title ?? `${labels.humanTitle} & ${labels.animalTitle}`}
    >
      <CompanionFigure config={config} size={svgSize} />
      {showLabel && (
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
          Lv.{config.companion.stage} {config.companion.name}
        </span>
      )}
    </span>
  );
}

export function VibeCompanionLink({
  input,
  href,
  title,
}: {
  input: CompanionInput;
  href: string;
  title?: string;
}) {
  return (
    <Link href={href} className="inline-flex shrink-0 rounded-full ring-2 ring-fuchsia-500/30 hover:ring-fuchsia-400/50">
      <VibeCompanion input={input} title={title} />
    </Link>
  );
}

export function VibeCompanionCard({
  input,
  companion: precomputed,
}: {
  input: CompanionInput;
  companion?: CompanionState;
}) {
  const config = resolveFigureConfig(input);
  if (precomputed) {
    config.companion = precomputed;
  }
  const labels = figureLabels(config);
  const { companion } = config;

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      <div className="mx-auto w-full max-w-[220px] shrink-0 lg:mx-0">
        <CompanionFigureScene config={config} labels={labels} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold text-zinc-100">
          {companion.name}{" "}
          <span className="text-sm font-normal text-zinc-500">
            · Stage {companion.stage}/5
          </span>
        </p>
        <p className="mt-1 text-sm text-zinc-300">
          {config.showHuman ? (
            <>
              Your <strong className="font-medium text-fuchsia-300">{labels.humanTitle}</strong>{" "}
              walks with a{" "}
              <strong className="font-medium text-orange-300">{labels.animalTitle}</strong>.
            </>
          ) : (
            <>
              Your <strong className="font-medium text-orange-300">{labels.animalTitle}</strong> is
              growing — keep your streak to unlock your human form.
            </>
          )}
        </p>
        <p className="mt-2 text-xs text-zinc-500">{companion.tagline}</p>
        <ul className="mt-3 space-y-1 text-[11px] text-zinc-500">
          <li>· Streak changes the animal species (fox → cat → owl → wolf → dragon)</li>
          <li>· Shop skins change your human outfit &amp; colors</li>
          <li>· Stage 3+ reveals the human figure beside your companion</li>
        </ul>
        {companion.nextName && (
          <div className="mt-4">
            <div className="flex justify-between text-[10px] uppercase tracking-wider text-zinc-500">
              <span>Evolve to {companion.nextName}</span>
              <span>{Math.round(companion.progress * 100)}%</span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-orange-400"
                style={{ width: `${companion.progress * 100}%` }}
              />
            </div>
          </div>
        )}
        {!companion.nextName && (
          <p className="mt-3 text-xs text-amber-300">✦ Max evolution — legend tier unlocked</p>
        )}
      </div>
    </div>
  );
}

export function VibeCompanionMiniGlyph({ config }: { config: FigureConfig }) {
  return <CompanionFigure config={config} size="sm" />;
}
