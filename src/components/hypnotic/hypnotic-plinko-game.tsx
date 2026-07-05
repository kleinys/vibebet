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
  velocityX: number;
  velocityY: number;
  active: boolean;
  finalSlot?: number;
  hasHitPeg?: boolean;
};

export function HypnoticPlinkoGame() {
  const [balls, setBalls] = useState<PlinkoBall[]>([]);
  const [ballIdCounter, setBallIdCounter] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [lastWinSlot, setLastWinSlot] = useState<number | null>(null);
  const [winMessage, setWinMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number | null>(null);

  const dropBall = () => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    setLastWinSlot(null);
    setWinMessage(null);
    
    const newBall: PlinkoBall = {
      id: ballIdCounter,
      x: 50, // Start from middle (percentage)
      y: 5,
      velocityX: (Math.random() - 0.5) * 0.5, // Small initial horizontal velocity
      velocityY: 0.5, // Initial downward velocity
      active: true,
    };

    setBalls((prev: PlinkoBall[]) => [...prev, newBall]);
    setBallIdCounter((prev: number) => prev + 1);
  };

  // Physics simulation loop
  useEffect(() => {
    const animate = (currentTime: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = currentTime;
      }
      
      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;
      
      setBalls((prevBalls: PlinkoBall[]) => {
        let stillAnimating = false;
        const updatedBalls: PlinkoBall[] = prevBalls.map((ball: PlinkoBall) => {
          if (!ball.active) return ball;

          // Apply gravity
          let newVelY = ball.velocityY + 0.05 * (deltaTime / 16);
          let newVelX = ball.velocityX;
          
          // Calculate new position
          let newX = ball.x + newVelX * (deltaTime / 16);
          let newY = ball.y + newVelY * (deltaTime / 16);
          
          // Boundary checks - keep ball within horizontal bounds
          if (newX < 2) {
            newX = 2;
            newVelX = Math.abs(newVelX) * 0.8; // Bounce with energy loss
          } else if (newX > 98) {
            newX = 98;
            newVelX = -Math.abs(newVelX) * 0.8;
          }
          
          // Simulate peg collisions (simplified)
          // We'll simulate pegs at fixed positions
          const rowHeight = 8;
          const pegRows = 8;
          
          for (let row = 1; row <= pegRows; row++) {
            const pegY = row * rowHeight + 10; // Pegs start at 18% down
            if (Math.abs(newY - pegY) < 2 && Math.abs(ball.y - pegY) >= 2) { // Ball is near a peg row
              // Determine if there's a peg at this X position
              const rowIndex = row - 1;
              const colsInRow = 10 - (rowIndex % 2); // Alternating rows
              const offsetX = (rowIndex % 2) * (100 / (colsInRow * 2)); // Offset for alternating rows
              
              for (let col = 0; col < colsInRow; col++) {
                const pegX = offsetX + (col * (100 / colsInRow));
                
                if (Math.abs(newX - pegX) < 3) { // Ball hits a peg
                  // Add some randomness to the bounce
                  newVelX += (Math.random() - 0.5) * 0.8;
                  newVelY *= 0.9; // Energy loss
                  
                  // Move ball away from peg to prevent sticking
                  if (newX < pegX) {
                    newX = pegX - 3;
                  } else {
                    newX = pegX + 3;
                  }
                  
                  break;
                }
              }
            }
          }
          
          // Check if ball reached the bottom (slots area)
          if (newY >= 80) {
            newY = 80; // Lock at bottom
            newVelY = 0;
            newVelX = 0;
            
            // Determine which slot it landed in
            const slotWidth = 100 / PLINKO_SLOTS.length;
            const slotIndex = Math.min(
              PLINKO_SLOTS.length - 1, 
              Math.max(0, Math.floor(newX / slotWidth))
            );
            
            // Return completed ball
            stillAnimating = true; // Keep checking other balls
            return {
              ...ball,
              x: newX,
              y: newY,
              velocityX: newVelX,
              velocityY: newVelY,
              active: false,
              finalSlot: slotIndex
            };
          }
          
          stillAnimating = true;
          return {
            ...ball,
            x: newX,
            y: newY,
            velocityX: newVelX,
            velocityY: newVelY
          };
        });

        // Check if any balls are still animating
        const anyStillAnimating = updatedBalls.some((ball: PlinkoBall) => ball.active);
        
        if (!anyStillAnimating && prevBalls.length > 0) {
          // All balls have finished, find the last one that finished
          const lastFinishedBall = prevBalls.find((ball: PlinkoBall) => !ball.active && ball.finalSlot !== undefined);
          if (lastFinishedBall && lastFinishedBall.finalSlot !== undefined) {
            setLastWinSlot(lastFinishedBall.finalSlot);
            setWinMessage(`Won ${PLINKO_SLOTS[lastFinishedBall.finalSlot].multiplier}× multiplier!`);
            setTimeout(() => {
              setWinMessage(null);
            }, 3000);
          }
          setIsAnimating(false);
        }
        
        return updatedBalls;
      });
      
      if (balls.some((ball: PlinkoBall) => ball.active)) {
        animationRef.current = requestAnimationFrame(animate);
      }
      
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    };
    
    if (balls.some((ball: PlinkoBall) => ball.active)) {
      animationRef.current = requestAnimationFrame(animate);
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
      setBalls((prev: PlinkoBall[]) => prev.filter((ball: PlinkoBall) => ball.active || 
        (ball.finalSlot !== undefined)));
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

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
        {Array.from({ length: 8 }).map((_, rowIndex: number) => (
          <div key={rowIndex} className="absolute w-full" style={{ top: `${rowIndex * 8 + 10}%` }}>
            {Array.from({ length: 10 - rowIndex % 2 }).map((_, colIndex: number) => {
              const offsetX = (rowIndex % 2) * (100 / ((10 - rowIndex % 2) * 2));
              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className="absolute w-2 h-2 rounded-full bg-fuchsia-400/80"
                  style={{
                    left: `${offsetX + (colIndex * (100 / (10 - rowIndex % 2)))}%`,
                    boxShadow: '0 0 8px rgba(192, 132, 252, 0.8)'
                  }}
                />
              );
            })}
          </div>
        ))}

        {/* Balls */}
        {balls.map((ball: PlinkoBall) => (
          <div
            key={ball.id}
            className={`absolute w-4 h-4 rounded-full bg-gradient-to-br from-amber-300 to-orange-500 shadow-lg ${
              ball.active ? 'animate-pulse' : ''
            }`}
            style={{
              left: `${ball.x}%`,
              top: `${ball.y}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 10
            }}
          />
        ))}

        {/* Slots at the bottom */}
        <div className="absolute bottom-0 left-0 right-0 flex h-16">
          {PLINKO_SLOTS.map((slot: PlinkoSlot, index: number) => (
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
        {winMessage && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-emerald-400 font-bold text-lg px-4 py-2 bg-black/50 rounded-lg animate-pulse">
            {winMessage}
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