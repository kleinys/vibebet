"use client";

import React, { useState, useEffect, useRef } from "react";

type PlinkoSlot = {
  multiplier: number;
  color: string;
  glowColor: string;
};

const PLINKO_SLOTS: PlinkoSlot[] = [
  { multiplier: 0.2, color: "bg-rose-700", glowColor: "shadow-rose-500/40" },
  { multiplier: 0.5, color: "bg-orange-600", glowColor: "shadow-orange-500/40" },
  { multiplier: 1, color: "bg-amber-600", glowColor: "shadow-amber-500/40" },
  { multiplier: 1.5, color: "bg-lime-600", glowColor: "shadow-lime-500/40" },
  { multiplier: 3, color: "bg-emerald-500", glowColor: "shadow-emerald-500/40" },
  { multiplier: 1.5, color: "bg-lime-600", glowColor: "shadow-lime-500/40" },
  { multiplier: 1, color: "bg-amber-600", glowColor: "shadow-amber-500/40" },
  { multiplier: 0.5, color: "bg-orange-600", glowColor: "shadow-orange-500/40" },
  { multiplier: 0.2, color: "bg-rose-700", glowColor: "shadow-rose-500/40" },
];

type PlinkoBall = {
  id: number;
  x: number;
  y: number;
  active: boolean;
  finalSlot?: number;
};

export function HypnoticPlinkoGame() {
  const [balls, setBalls] = useState<PlinkoBall[]>([]);
  const [ballIdCounter, setBallIdCounter] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [lastWinSlot, setLastWinSlot] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);

  const dropBall = () => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    setLastWinSlot(null);
    
    const newBall: PlinkoBall = {
      id: ballIdCounter,
      x: 50, // Start from middle (percentage)
      y: 0,
      active: true,
    };

    setBalls(prev => [...prev, newBall]);
    setBallIdCounter(prev => prev + 1);
  };

  // Animation loop
  useEffect(() => {
    if (balls.some(ball => ball.active)) {
      animationRef.current = requestAnimationFrame(() => {
        setBalls(prevBalls => {
          const updatedBalls = prevBalls.map(ball => {
            if (!ball.active) return ball;

            // Simulate physics - move ball downward with slight horizontal movement
            const newY = ball.y + 1.5;
            const newX = ball.x + (Math.random() - 0.5) * 1.5; // Random horizontal movement
            
            // Check if ball reached the bottom (simulate hitting pegs)
            if (newY >= 85) { // 85% down the board
              // Determine which slot it landed in
              const slotWidth = 100 / PLINKO_SLOTS.length;
              const slotIndex = Math.min(
                PLINKO_SLOTS.length - 1, 
                Math.floor(newX / slotWidth)
              );
              
              // Return completed ball
              return {
                ...ball,
                y: 85,
                active: false,
                finalSlot: slotIndex
              };
            }

            return {
              ...ball,
              x: Math.max(2, Math.min(98, newX)), // Keep within bounds
              y: newY
            };
          });

          // Check if all balls have finished animating
          const stillAnimating = updatedBalls.some(ball => ball.active);
          if (!stillAnimating) {
            setIsAnimating(false);
            
            // Find the last completed ball and set the winning slot
            const lastCompletedBall = updatedBalls.find(ball => 
              !ball.active && ball.finalSlot !== undefined
            );
            
            if (lastCompletedBall) {
              setLastWinSlot(lastCompletedBall.finalSlot);
            }
          }

          return updatedBalls;
        });
      });
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [balls]);

  // Clean up completed balls after animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setBalls(prev => prev.filter(ball => ball.active || 
        (Date.now() - (ball as any)._timestamp) < 3000)); // Keep completed balls for 3 seconds
    }, 3000);

    return () => clearTimeout(timer);
  }, [balls]);

  return (
    <div className="hypnotic-plinko-game w-full max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="font-[family-name:var(--font-gothic)] text-xl text-fuchsia-100 mb-2">Hypnotic Plinko</h2>
        <p className="text-xs text-zinc-400">
          Drop a chip — watch it bounce to a random slot
        </p>
      </div>
      
      <div 
        ref={containerRef}
        className="relative w-full h-80 bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-xl border border-fuchsia-500/30 overflow-hidden"
      >
        {/* Pegs */}
        {Array.from({ length: 8 }).map((_, rowIndex) => (
          <div key={rowIndex} className="absolute w-full" style={{ top: `${rowIndex * 10 + 10}%` }}>
            {Array.from({ length: 10 - rowIndex % 2 }).map((_, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className="absolute w-2 h-2 rounded-full bg-fuchsia-400/60"
                style={{
                  left: `${(colIndex * 10) + (rowIndex % 2) * 5}%`,
                  boxShadow: '0 0 8px rgba(192, 132, 252, 0.6)'
                }}
              />
            ))}
          </div>
        ))}

        {/* Balls */}
        {balls.map((ball) => (
          <div
            key={ball.id}
            className={`absolute w-4 h-4 rounded-full bg-gradient-to-br from-amber-300 to-orange-500 shadow-lg ${
              ball.active ? 'animate-pulse' : ''
            }`}
            style={{
              left: `${ball.x}%`,
              top: `${ball.y}%`,
              transform: 'translate(-50%, -50%)',
              transition: ball.active ? 'none' : 'all 0.3s ease',
              zIndex: 10
            }}
          />
        ))}

        {/* Slots at the bottom */}
        <div className="absolute bottom-0 left-0 right-0 flex h-16">
          {PLINKO_SLOTS.map((slot, index) => (
            <div
              key={index}
              className={`flex-1 flex flex-col items-center justify-end border-t-2 border-l border-white/20 p-1 text-[9px] transition-all duration-500 ${
                lastWinSlot === index 
                  ? `${slot.color} ${slot.glowColor} shadow-lg scale-105` 
                  : 'bg-zinc-800/80'
              }`}
            >
              <span className="font-bold text-white">{slot.multiplier}×</span>
            </div>
          ))}
        </div>

        {/* Winner indicator */}
        {lastWinSlot !== null && (
          <div 
            className="absolute top-4 left-1/2 transform -translate-x-1/2 animate-bounce text-emerald-400 font-bold text-lg px-4 py-2 bg-black/50 rounded-lg"
            style={{ animation: 'hypnotic-pulse 1.5s infinite' }}
          >
            Won {PLINKO_SLOTS[lastWinSlot].multiplier}× multiplier!
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-center">
        <button
          type="button"
          disabled={isAnimating}
          onClick={dropBall}
          className="hypnotic-plinko-drop-btn rounded-lg bg-gradient-to-r from-fuchsia-600 to-purple-600 px-6 py-3 font-medium text-white hover:from-fuchsia-500 hover:to-purple-500 disabled:opacity-50 transition-all duration-300 shadow-lg shadow-fuchsia-500/20 hover:shadow-fuchsia-500/30"
        >
          {isAnimating ? "Dropping..." : "Drop Chip"}
        </button>
      </div>
    </div>
  );
}

// Add custom animation styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes hypnotic-pulse {
      0%, 100% { opacity: 1; transform: translateX(-50%) scale(1); }
      50% { opacity: 0.7; transform: translateX(-50%) scale(1.05); }
    }
  `;
  document.head.appendChild(style);
}