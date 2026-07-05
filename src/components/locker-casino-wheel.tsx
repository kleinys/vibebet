"use client";

import { WHEEL_SEGMENTS } from "@/components/companion-locker-rewards";

const SIZE = 280;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 128;
const INNER = 52;

function polar(r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function segmentPath(i: number, total: number) {
  const step = 360 / total;
  const a0 = i * step;
  const a1 = (i + 1) * step;
  const p0 = polar(R, a0);
  const p1 = polar(R, a1);
  const pi0 = polar(INNER, a0);
  const pi1 = polar(INNER, a1);
  const large = step > 180 ? 1 : 0;
  return [
    `M ${pi0.x} ${pi0.y}`,
    `L ${p0.x} ${p0.y}`,
    `A ${R} ${R} 0 ${large} 1 ${p1.x} ${p1.y}`,
    `L ${pi1.x} ${pi1.y}`,
    `A ${INNER} ${INNER} 0 ${large} 0 ${pi0.x} ${pi0.y}`,
    "Z",
  ].join(" ");
}

function shortLabel(label: string) {
  if (label.includes("JACKPOT")) return "2.5K";
  const n = label.replace(" VIBE", "");
  return n;
}

export function LockerCasinoWheel({
  rotation,
  spinning,
  glowing = false,
}: {
  rotation: number;
  spinning: boolean;
  glowing?: boolean;
}) {
  const total = WHEEL_SEGMENTS.length;
  const step = 360 / total;

  return (
    <div
      className={`locker-casino-wheel-wrap ${spinning ? "locker-casino-wheel-wrap--spin" : ""} ${glowing ? "locker-casino-wheel-wrap--glow" : ""}`}
    >
      <div className="locker-casino-wheel-pointer" aria-hidden />
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="locker-casino-wheel"
        style={{ transform: `rotate(${rotation}deg)` }}
        aria-hidden
      >
        <defs>
          <filter id="wheel-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#fbbf24" floodOpacity="0.55" />
            <feDropShadow dx="0" dy="0" stdDeviation="10" floodColor="#a855f7" floodOpacity="0.35" />
          </filter>
          <radialGradient id="wheel-hub" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#3f3f46" />
            <stop offset="100%" stopColor="#09090b" />
          </radialGradient>
        </defs>

        <circle cx={CX} cy={CY} r={R + 6} fill="#18181b" stroke="#fbbf24" strokeWidth="3" filter="url(#wheel-glow)" />
        <circle cx={CX} cy={CY} r={R + 2} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

        {WHEEL_SEGMENTS.map((seg, i) => (
          <path
            key={seg.label}
            d={segmentPath(i, total)}
            fill={seg.color}
            stroke="rgba(0,0,0,0.35)"
            strokeWidth="1"
          />
        ))}

        {WHEEL_SEGMENTS.map((seg, i) => {
          const mid = i * step + step / 2;
          const pos = polar(R * 0.72, mid);
          return (
            <text
              key={`t-${seg.label}`}
              x={pos.x}
              y={pos.y}
              fill={seg.text}
              fontSize={seg.label.includes("JACKPOT") ? 11 : 12}
              fontWeight="800"
              textAnchor="middle"
              dominantBaseline="middle"
              transform={`rotate(${mid + 90}, ${pos.x}, ${pos.y})`}
              className="locker-casino-wheel__label"
            >
              {shortLabel(seg.label)}
            </text>
          );
        })}

        {/* Pegs */}
        {Array.from({ length: total }).map((_, i) => {
          const p = polar(R + 1, i * step);
          return (
            <circle
              key={`peg-${i}`}
              cx={p.x}
              cy={p.y}
              r={3}
              fill="#fef3c7"
              stroke="#b45309"
              strokeWidth="0.5"
            />
          );
        })}

        <circle cx={CX} cy={CY} r={INNER + 4} fill="url(#wheel-hub)" stroke="#52525b" strokeWidth="2" />
        <circle cx={CX} cy={CY} r={INNER - 8} fill="#18181b" stroke="rgba(167,139,250,0.4)" strokeWidth="1" />
        <text
          x={CX}
          y={CY}
          fill="#e9d5ff"
          fontSize="11"
          fontWeight="700"
          textAnchor="middle"
          dominantBaseline="middle"
          className="locker-casino-wheel__hub"
        >
          {spinning ? "…" : "SPIN"}
        </text>
      </svg>
    </div>
  );
}
