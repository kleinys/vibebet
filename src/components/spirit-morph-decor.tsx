import type { CSSProperties } from "react";
import type { SpiritMorphElement } from "@/lib/companion-motion";
import { phenomenonImagePath } from "@/lib/phenomenon-art";

/** Decorative layers for each unique orbit phenomenon (CSS fallback). */
export function SpiritMorphDecor({ morph }: { morph: SpiritMorphElement }) {
  switch (morph) {
    case "fire":
      return (
        <>
          <span className="companion-spirit-element__flame companion-spirit-element__flame--1" />
          <span className="companion-spirit-element__flame companion-spirit-element__flame--2" />
          <span className="companion-spirit-element__flame companion-spirit-element__flame--3" />
        </>
      );
    case "forge":
      return (
        <>
          <span className="companion-spirit-element__spark companion-spirit-element__spark--1" />
          <span className="companion-spirit-element__spark companion-spirit-element__spark--2" />
          <span className="companion-spirit-element__flame companion-spirit-element__flame--1" />
        </>
      );
    case "solar":
      return (
        <>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <span
              key={deg}
              className="companion-spirit-element__ray"
              style={{ "--ray-angle": `${deg}deg` } as CSSProperties}
            />
          ))}
          <span className="companion-spirit-element__corona" />
        </>
      );
    case "storm":
    case "thunder":
      return (
        <>
          <span className="companion-spirit-element__cloud" />
          <span className="companion-spirit-element__bolt companion-spirit-element__bolt--1" />
          <span className="companion-spirit-element__bolt companion-spirit-element__bolt--2" />
          <span className="companion-spirit-element__bolt companion-spirit-element__bolt--3" />
        </>
      );
    case "frost":
      return (
        <>
          <span className="companion-spirit-element__shard companion-spirit-element__shard--1" />
          <span className="companion-spirit-element__shard companion-spirit-element__shard--2" />
          <span className="companion-spirit-element__shard companion-spirit-element__shard--3" />
        </>
      );
    case "lunar":
      return (
        <>
          <span className="companion-spirit-element__moon-ring" />
          <span className="companion-spirit-element__moon-crescent" />
          <span className="companion-spirit-element__stardust companion-spirit-element__stardust--1" />
          <span className="companion-spirit-element__stardust companion-spirit-element__stardust--2" />
          <span className="companion-spirit-element__stardust companion-spirit-element__stardust--3" />
        </>
      );
    case "aurora":
      return (
        <>
          <span className="companion-spirit-element__ribbon companion-spirit-element__ribbon--1" />
          <span className="companion-spirit-element__ribbon companion-spirit-element__ribbon--2" />
          <span className="companion-spirit-element__ribbon companion-spirit-element__ribbon--3" />
        </>
      );
    case "arcane":
    case "rune":
    case "cosmic":
      return (
        <>
          <span className="companion-spirit-element__rune-ring" />
          <span className="companion-spirit-element__spark companion-spirit-element__spark--1" />
          <span className="companion-spirit-element__spark companion-spirit-element__spark--2" />
          <span className="companion-spirit-element__spark companion-spirit-element__spark--3" />
          <span className="companion-spirit-element__spark companion-spirit-element__spark--4" />
        </>
      );
    case "neon":
      return (
        <>
          <span className="companion-spirit-element__neon-ring companion-spirit-element__neon-ring--1" />
          <span className="companion-spirit-element__neon-ring companion-spirit-element__neon-ring--2" />
          <span className="companion-spirit-element__spark companion-spirit-element__spark--1" />
          <span className="companion-spirit-element__spark companion-spirit-element__spark--2" />
        </>
      );
    case "voidrift":
      return (
        <>
          <span className="companion-spirit-element__void-ring" />
          <span className="companion-spirit-element__void-spiral" />
          <span className="companion-spirit-element__bolt companion-spirit-element__bolt--1" />
          <span className="companion-spirit-element__bolt companion-spirit-element__bolt--2" />
          <span className="companion-spirit-element__bolt companion-spirit-element__bolt--3" />
        </>
      );
    case "reddwarf":
      return (
        <>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <span
              key={deg}
              className="companion-spirit-element__ray companion-spirit-element__ray--dwarf"
              style={{ "--ray-angle": `${deg}deg` } as CSSProperties}
            />
          ))}
          <span className="companion-spirit-element__stellar-flare companion-spirit-element__stellar-flare--1" />
          <span className="companion-spirit-element__stellar-flare companion-spirit-element__stellar-flare--2" />
        </>
      );
    case "nebula":
      return (
        <>
          <span className="companion-spirit-element__nebula-cloud companion-spirit-element__nebula-cloud--1" />
          <span className="companion-spirit-element__nebula-cloud companion-spirit-element__nebula-cloud--2" />
          <span className="companion-spirit-element__spark companion-spirit-element__spark--1" />
        </>
      );
    case "eclipse":
      return (
        <>
          <span className="companion-spirit-element__eclipse-ring" />
          <span className="companion-spirit-element__moon-crescent" />
          <span className="companion-spirit-element__blood-pulse" />
        </>
      );
    default:
      return null;
  }
}

export function SpiritElementBall({ morph }: { morph: SpiritMorphElement }) {
  const src = phenomenonImagePath(morph);

  return (
    <div
      className={`companion-spirit-element companion-spirit-element--${morph} companion-spirit-element--art`}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" draggable={false} className="companion-spirit-element__art" />
      <span className="companion-spirit-element__art-glow" />
    </div>
  );
}
