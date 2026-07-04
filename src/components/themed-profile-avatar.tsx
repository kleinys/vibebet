import type { FigureConfig } from "@/lib/companion-figure";
import { humanImagePath } from "@/lib/character-art";
import { skinStyleForSlug } from "@/lib/cosmetic-styles";

const SIZES = {
  sm: "h-10 w-10",
  md: "h-12 w-12",
  lg: "h-16 w-16",
} as const;

function ProfileSilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <circle cx="32" cy="22" r="11" fill="white" opacity="0.92" />
      <path
        d="M12 58c2-14 11-22 20-22s18 8 20 22"
        fill="white"
        opacity="0.88"
      />
    </svg>
  );
}

/** Circular profile badge — themed to equipped trainer skin (Windows-style avatar). */
export function ThemedProfileAvatar({
  config,
  size = "md",
  className = "",
}: {
  config: FigureConfig;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const skinStyle = skinStyleForSlug(config.skinSlug);
  const portrait = config.showHuman
    ? humanImagePath(config.human, config.skinSlug)
    : humanImagePath(config.human, config.skinSlug);

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full ring-2 shadow-lg ${skinStyle.ring} ${skinStyle.glow} ${SIZES[size]} ${className}`}
      style={{
        background: `linear-gradient(145deg, ${config.palette.aura} 0%, ${config.palette.accent} 55%, ${config.palette.animalDark} 100%)`,
      }}
    >
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(circle at 30% 20%, ${config.palette.accent}88 0%, transparent 55%)`,
        }}
        aria-hidden
      />
      {portrait ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={portrait}
          alt=""
          draggable={false}
          className="absolute inset-x-0 bottom-0 h-[118%] w-full object-cover object-top"
        />
      ) : (
        <ProfileSilhouette className="absolute inset-0 m-auto h-[70%] w-[70%] drop-shadow-md" />
      )}
    </div>
  );
}
