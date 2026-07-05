"use client";

import {
  WHEEL_SEGMENTS,
  wheelRotationToSegment,
  wheelLabelFontSize,
  isJackpotSegment,
  wheelSegmentLayout,
} from "@/lib/wheel-segments";

export const WHEEL_POINTER_INDEX = 0;

const SIZE = 320;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUTER = 148;
const R_INNER = 44;

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
  if (label.includes("2500") || label.includes("JACKPOT")) return "2500";
  return label.replace(" VIBE", "");
}

export function LockerCasinoWheel({
  rotation,
  spinning,
  glowing = false,
  size = "panel",
}: {
  rotation: number;
  spinning: boolean;
  glowing?: boolean;
  size?: "panel" | "cinema";
}) {
  const layout = wheelSegmentLayout();
  const uid = size === "cinema" ? "wheel-cinema" : "wheel-panel";

  return (
    <div
      className={`locker-casino-wheel-wrap locker-casino-wheel-wrap--${size} ${spinning ? "locker-casino-wheel-wrap--spin" : ""} ${glowing ? "locker-casino-wheel-wrap--glow" : ""}`}
    >
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="locker-casino-wheel-svg"
        aria-hidden
      >
        <defs>
          <radialGradient id={`${uid}-hub`} cx="50%" cy="38%" r="65%">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="55%" stopColor="#3b0764" />
            <stop offset="100%" stopColor="#09090b" />
          </radialGradient>
          <linearGradient id={`${uid}-rim`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef9c3" />
            <stop offset="35%" stopColor="#fde047" />
            <stop offset="70%" stopColor="#ca8a04" />
            <stop offset="100%" stopColor="#78350f" />
          </linearGradient>
          <filter id={`${uid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {WHEEL_SEGMENTS.map((seg, i) => (
            <linearGradient
              key={`grad-${seg.label}`}
              id={`${uid}-wedge-${i}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor={seg.color} stopOpacity={1} />
              <stop offset="100%" stopColor={seg.color} stopOpacity={0.72} />
            </linearGradient>
          ))}
        </defs>

        {/* Ambient glow ring */}
        <circle
          cx={CX}
          cy={CY}
          r={R_OUTER + 14}
          fill="none"
          stroke="rgba(251,191,36,0.15)"
          strokeWidth={8}
          className={spinning ? "locker-casino-wheel-svg__aura" : undefined}
        />

        {/* Gold rim + studs */}
        <circle cx={CX} cy={CY} r={R_OUTER + 8} fill="none" stroke={`url(#${uid}-rim)`} strokeWidth={12} />
        {Array.from({ length: 32 }).map((_, i) => {
          const p = polar(R_OUTER + 4, i * 11.25);
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={i % 2 === 0 ? 2.8 : 1.8}
              fill={i % 4 === 0 ? "#fef3c7" : "#fde68a"}
              opacity={0.9}
            />
          );
        })}

        <g
          className="locker-casino-wheel-svg__disk"
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: `${CX}px ${CY}px`,
            transformBox: "view-box",
          }}
        >
          {layout.map((seg) => {
            const start = seg.start;
            const end = seg.end;
            const mid = seg.mid;
            const labelPos = polar(R_OUTER * (seg.sweep < 14 ? 0.68 : 0.72), mid);
            const jackpot = isJackpotSegment(seg.label);
            const fontSize = wheelLabelFontSize(seg.label, size);
            return (
              <g key={seg.label}>
                <path
                  d={wedgePath(start, end)}
                  fill={`url(#${uid}-wedge-${seg.index})`}
                  stroke="#0c0a09"
                  strokeWidth={1.8}
                />
                {jackpot && (
                  <path
                    d={wedgePath(start, end)}
                    fill="none"
                    stroke="#fef08a"
                    strokeWidth={2.5}
                    opacity={0.55}
                  />
                )}
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  fill={seg.text}
                  fontSize={fontSize}
                  fontWeight={900}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${mid}, ${labelPos.x}, ${labelPos.y})`}
                  className={`locker-casino-wheel-svg__label ${jackpot ? "locker-casino-wheel-svg__label--jackpot" : ""}`}
                  filter={`url(#${uid}-glow)`}
                >
                  {labelForSegment(seg.label)}
                </text>
              </g>
            );
          })}
        </g>

        <circle cx={CX} cy={CY} r={R_INNER + 2} fill="#1c1917" stroke="#ca8a04" strokeWidth={3} />
        <circle cx={CX} cy={CY} r={R_INNER - 2} fill={`url(#${uid}-hub)`} stroke="#fde68a" strokeWidth={2} />
        <text
          x={CX}
          y={CY}
          fill="#faf5ff"
          fontSize={size === "cinema" ? 14 : 12}
          fontWeight={900}
          textAnchor="middle"
          dominantBaseline="middle"
          letterSpacing="0.14em"
        >
          VIBE
        </text>
        <polygon
          points={`${CX},${CY - R_OUTER - 18} ${CX - 14},${CY - R_OUTER + 6} ${CX + 14},${CY - R_OUTER + 6}`}
          fill="#fde047"
          stroke="#b45309"
          strokeWidth={1.5}
          filter={`url(#${uid}-glow)`}
        />
      </svg>
    </div>
  );
}
