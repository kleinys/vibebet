/** Shared fantasy RPG SVG defs — bioluminescent glow, rim light, #020617 compatible */

export function FantasySvgDefs({ id }: { id: string }) {
  return (
    <defs>
      <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.5" result="blur" />
        <feColorMatrix
          in="blur"
          type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.85 0"
          result="glow"
        />
        <feMerge>
          <feMergeNode in="glow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <linearGradient id={`${id}-violet`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#a78bfa" />
        <stop offset="50%" stopColor="#7c3aed" />
        <stop offset="100%" stopColor="#4c1d95" />
      </linearGradient>
      <linearGradient id={`${id}-emerald`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#5eead4" />
        <stop offset="50%" stopColor="#14b8a6" />
        <stop offset="100%" stopColor="#0f766e" />
      </linearGradient>
      <linearGradient id={`${id}-fuchsia`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f0abfc" />
        <stop offset="50%" stopColor="#d946ef" />
        <stop offset="100%" stopColor="#a21caf" />
      </linearGradient>
      <linearGradient id={`${id}-amber`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fde68a" />
        <stop offset="50%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#b45309" />
      </linearGradient>
      <radialGradient id={`${id}-rim`} cx="30%" cy="25%" r="70%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

export function ModeIconPredict({ className = "h-5 w-5" }: { className?: string }) {
  const id = "predict";
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <FantasySvgDefs id={id} />
      <g filter={`url(#${id}-glow)`}>
        <circle cx="16" cy="16" r="11" fill={`url(#${id}-fuchsia)`} opacity="0.25" />
        <path
          d="M16 6 L20 14 L28 16 L20 18 L16 26 L12 18 L4 16 L12 14 Z"
          fill={`url(#${id}-fuchsia)`}
          stroke="#f0abfc"
          strokeWidth="0.8"
        />
        <circle cx="16" cy="16" r="4" fill="#020617" opacity="0.5" />
        <circle cx="16" cy="16" r="2.5" fill="#e879f9" />
        <ellipse cx="12" cy="11" rx="4" ry="3" fill={`url(#${id}-rim)`} opacity="0.6" />
      </g>
    </svg>
  );
}

export function ModeIconCompete({ className = "h-5 w-5" }: { className?: string }) {
  const id = "compete";
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <FantasySvgDefs id={id} />
      <g filter={`url(#${id}-glow)`}>
        <path
          d="M8 24 L14 8 L16 14 L18 8 L24 24 L16 20 Z"
          fill={`url(#${id}-violet)`}
          stroke="#c4b5fd"
          strokeWidth="0.8"
          transform="rotate(-18 16 16)"
        />
        <path
          d="M8 24 L14 8 L16 14 L18 8 L24 24 L16 20 Z"
          fill={`url(#${id}-violet)`}
          stroke="#c4b5fd"
          strokeWidth="0.8"
          transform="rotate(18 16 16)"
        />
        <circle cx="16" cy="16" r="3" fill="#020617" stroke="#a78bfa" strokeWidth="1" />
        <ellipse cx="13" cy="13" rx="3" ry="2" fill={`url(#${id}-rim)`} opacity="0.5" />
      </g>
    </svg>
  );
}

export function ModeIconWatch({ className = "h-5 w-5" }: { className?: string }) {
  const id = "watch";
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <FantasySvgDefs id={id} />
      <g filter={`url(#${id}-glow)`}>
        <rect x="5" y="9" width="22" height="14" rx="3" fill={`url(#${id}-emerald)`} stroke="#5eead4" strokeWidth="0.8" />
        <circle cx="16" cy="16" r="5" fill="#020617" stroke="#2dd4bf" strokeWidth="1" />
        <circle cx="16" cy="16" r="2" fill="#5eead4" />
        <path d="M16 16 L16 12" stroke="#99f6e4" strokeWidth="1.2" strokeLinecap="round" />
        <ellipse cx="11" cy="12" rx="3" ry="2" fill={`url(#${id}-rim)`} opacity="0.45" />
      </g>
    </svg>
  );
}

export function CurrencyIconVibe({ className = "h-4 w-4" }: { className?: string }) {
  const id = "vibe";
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <FantasySvgDefs id={id} />
      <g filter={`url(#${id}-glow)`}>
        <circle cx="12" cy="12" r="9" fill={`url(#${id}-amber)`} stroke="#fde68a" strokeWidth="0.7" />
        <circle cx="12" cy="12" r="4.5" fill="#020617" opacity="0.35" />
        <circle cx="12" cy="12" r="2" fill="#fbbf24" />
        <ellipse cx="9" cy="9" rx="3" ry="2" fill={`url(#${id}-rim)`} opacity="0.55" />
      </g>
    </svg>
  );
}

export function CurrencyIconGem({ className = "h-4 w-4" }: { className?: string }) {
  const id = "gem";
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <FantasySvgDefs id={id} />
      <g filter={`url(#${id}-glow)`}>
        <path
          d="M12 3 L18 9 L12 21 L6 9 Z"
          fill={`url(#${id}-fuchsia)`}
          stroke="#f0abfc"
          strokeWidth="0.7"
        />
        <path d="M6 9 L18 9 L12 12 Z" fill="#020617" opacity="0.25" />
        <ellipse cx="10" cy="8" rx="2.5" ry="1.5" fill={`url(#${id}-rim)`} opacity="0.6" />
      </g>
    </svg>
  );
}

export const MODE_ICONS = {
  predict: ModeIconPredict,
  compete: ModeIconCompete,
  watch: ModeIconWatch,
} as const;
