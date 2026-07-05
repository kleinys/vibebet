"use client";

import { WHEEL_SEGMENTS } from "@/components/companion-locker-rewards";

/** Segment 0 wedge starts at 12 o'clock; pointer fixed at top. */
export const WHEEL_POINTER_INDEX = 0;

const SIZE = 280;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUTER = 132;
const R_INNER = 38;

function polar(r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function wedgePath(startDeg: number, endDeg: number) {
  const start = polar(R_OUTER, startDeg);
  const end = polar(R_OUTER, endDeg);
  const innerStart = polar(R_INNER, endDeg);
  const innerEnd = polar(R_INNER, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${innerEnd.x} ${innerEnd.y}`,
    `L ${start.x} ${start.y}`,
    `A ${R_OUTER} ${R_OUTER} 0 ${large} 1 ${end.x} ${end.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${R_INNER} ${R_INNER} 0 ${large} 0 ${innerEnd.x} ${innerEnd.y}`,
    "Z",
  ].join(" ");
}

function labelForSegment(label: string) {
  return label.replace(" VIBE", "").replace(" JACKPOT", " JP");
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
  const segmentAngle = 360 / WHEEL_SEGMENTS.length;

  return (
    <div
      className={`locker-casino-wheel-wrap ${spinning ? "locker-casino-wheel-wrap--spin" : ""} ${glowing ? "locker-casino-wheel-wrap--glow" : ""}`}
    >
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="locker-casino-wheel-svg"
        aria-hidden
      >
        <defs>
          <radialGradient id="wheel-hub-grad" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#4c1d95" />
            <stop offset="100%" stopColor="#09090b" />
          </radialGradient>
          <linearGradient id="wheel-rim-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="50%" stopColor="#ca8a04" />
            <stop offset="100%" stopColor="#92400e" />
          </linearGradient>
        </defs>

        {/* Static gold rim + studs */}
        <circle cx={CX} cy={CY} r={R_OUTER + 6} fill="none" stroke="url(#wheel-rim-grad)" strokeWidth={10} />
        {Array.from({ length: 24 }).map((_, i) => {
          const p = polar(R_OUTER + 2, i * 15);
          return (
            <circle key={i} cx={p.x} cy={p.y} r={2.2} fill="#fef3c7" opacity={0.85} />
          );
        })}

        {/* Rotating disk */}
        <g
          className="locker-casino-wheel-svg__disk"
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: `${CX}px ${CY}px`,
            transformBox: "view-box",
          }}
        >
          {WHEEL_SEGMENTS.map((seg, i) => {
            const start = i * segmentAngle;
            const end = (i + 1) * segmentAngle;
            const mid = start + segmentAngle / 2;
            const labelPos = polar(R_OUTER * 0.72, mid);
            return (
              <g key={seg.label}>
                <path d={wedgePath(start, end)} fill={seg.color} stroke="#1c1917" strokeWidth={1.2} />
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  fill={seg.text}
                  fontSize={seg.label.includes("2500") ? 7 : 8}
                  fontWeight={800}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${mid}, ${labelPos.x}, ${labelPos.y})`}
                  className="locker-casino-wheel-svg__label"
                >
                  {labelForSegment(seg.label)}
                </text>
              </g>
            );
          })}
        </g>

        {/* Static hub + pointer */}
        <circle cx={CX} cy={CY} r={R_INNER - 2} fill="url(#wheel-hub-grad)" stroke="#fde68a" strokeWidth={2} />
        <text
          x={CX}
          y={CY}
          fill="#e9d5ff"
          fontSize={11}
          fontWeight={800}
          textAnchor="middle"
          dominantBaseline="middle"
          letterSpacing="0.12em"
        >
          VIBE
        </text>
        <polygon
          points={`${CX},${CY - R_OUTER - 14} ${CX - 11},${CY - R_OUTER + 4} ${CX + 11},${CY - R_OUTER + 4}`}
          fill="#fde047"
          stroke="#ca8a04"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
}
