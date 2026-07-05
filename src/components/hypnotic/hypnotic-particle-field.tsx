"use client";

import { useEffect, useRef, useState } from "react";

type Particle = { id: number; x: number; y: number; size: number; delay: number };

export function HypnoticParticleField({
  targetSelector,
  intensity = 1,
}: {
  targetSelector?: string;
  intensity?: number;
}) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const count = Math.round(18 * intensity);
    setParticles(
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 2 + Math.random() * 4,
        delay: Math.random() * 4,
      })),
    );
  }, [intensity]);

  useEffect(() => {
    function onMove(e: MouseEvent | TouchEvent) {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
      const clientY = "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
      const nx = ((clientX - rect.left) / rect.width - 0.5) * -12;
      const ny = ((clientY - rect.top) / rect.height - 0.5) * -8;
      setParallax({ x: nx, y: ny });
    }
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`hypnotic-particles ${targetSelector ? "hypnotic-particles--magnet" : ""}`}
      style={
        {
          "--parallax-x": `${parallax.x}px`,
          "--parallax-y": `${parallax.y}px`,
        } as React.CSSProperties
      }
      aria-hidden
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="hypnotic-particles__ember"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
      {targetSelector && <span className="hypnotic-particles__trail" />}
    </div>
  );
}
