"use client";

import React, { useState, useEffect, useRef } from "react";

type PlinkoSlot = {
  multiplier: number;
  color: string;
  glowColor: string;
};

const PLINKO_SLOTS: PlinkoSlot[] = [
  { multiplier: 0.2, color: "bg-blue-500", glowColor: "shadow-blue-500/50" },
  { multiplier: 0.5, color: "bg-green-500", glowColor: "shadow-green-500/50" },
  { multiplier: 1, color: "bg-yellow-500", glowColor: "shadow-yellow-500/50" },
  { multiplier: 1.5, color: "bg-red-500", glowColor: "shadow-red-500/50" },
  { multiplier: 3, color: "bg-orange-500", glowColor: "shadow-orange-500/50" },
  { multiplier: 1.5, color: "bg-red-500", glowColor: "shadow-red-500/50" },
  { multiplier: 1, color: "bg-yellow-500", glowColor: "shadow-yellow-500/50" },
  { multiplier: 0.5, color: "bg-green-500", glowColor: "shadow-green-500/50" },
  { multiplier: 0.2, color: "bg-blue-500", glowColor: "shadow-blue-500/50" },
];

type PlinkoBall = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  active: boolean;
  age: number;
  trail: Array<{ x: number; y: number; life: number }>;
  finalSlot?: number;
};

type Peg = {
  x: number;
  y: number;
  globalIndex: number;
  rowIndex: number;
  colIndex: number;
};

type PegFlashTimer = {
  pegGlobalIndex: number;
  timer: number;
};

export function HypnoticPlinkoGame() {
  const [balls, setBalls] = useState<PlinkoBall[]>([]);
  const [ballIdCounter, setBallIdCounter] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [highlightedSlot, setHighlightedSlot] = useState<number | null>(null);
  const [winMessage, setWinMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const pegFlashTimersRef = useRef<PegFlashTimer[]>([]); // This will now be empty since we removed pegs
  const landedBallsRef = useRef<Array<{
    x: number;
    y: number;
    timer: number;
    opacity: number;
  }>>([]);
  
  // Constants for physics and layout
  const CANVAS_WIDTH = 650;
  const CANVAS_HEIGHT = 640;
  const LEFT_WALL = 48;
  const RIGHT_WALL = 602;
  const PEG_AREA_TOP = 78;
  const PEG_AREA_BOTTOM = 475;
  const SLOT_DIVIDER_TOP = 482;
  const SLOT_DIVIDER_BOTTOM = 548;
  const SLOT_BOTTOM_Y = 555;
  const NUM_SLOTS = 9; // Using 9 slots to match our PLINKO_SLOTS array
  const BALL_RADIUS = 7;
  const CENTER_DROP_X = (LEFT_WALL + RIGHT_WALL) / 2; // Center drop position
  
  // Calculate slot boundaries
  const slotWidth = (RIGHT_WALL - LEFT_WALL) / NUM_SLOTS;
  const slotBoundaries = Array.from({ length: NUM_SLOTS + 1 }, (_, i) => LEFT_WALL + i * slotWidth);
  const slotCenters = Array.from({ length: NUM_SLOTS }, (_, i) => LEFT_WALL + slotWidth * i + slotWidth / 2);

  // No more pegs needed
  const pegPositions = useRef<any[]>([]);
  
  useEffect(() => {
    // No more pegs - empty array
    pegPositions.current = [];
  }, []);

  const GRAVITY = 0.25; // Reduced gravity for more realistic falling
  const DAMPING = 0.75; // Increased damping for more realistic energy loss
  const WALL_DAMPING = 0.7; // Wall damping factor
  const PEG_RESTITUTION = 0.6; // Coefficient of restitution (kept for potential future use)
  const DROP_COOLDOWN_MAX = 12;
  const [dropCooldown, setDropCooldown] = useState<number>(0);

  const createBall = (x: number, y: number): PlinkoBall => {
    return {
      id: ballIdCounter,
      x,
      y,
      vx: (Math.random() - 0.5) * 0.8, // Reduced initial horizontal velocity for more controlled drops
      vy: 0.5 + Math.random() * 0.5, // Reduced initial vertical velocity
      radius: BALL_RADIUS,
      active: true,
      age: 0,
      trail: [],
    };
  };


  const updateBall = (ball: PlinkoBall) => {
    if (!ball.active) return ball;

    ball.age++;
    
    // Apply gravity
    ball.vy += GRAVITY;
    
    // Update position
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Limit max speed to prevent balls from going too fast
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    const maxSpeed = 15; // Reduced max speed
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      ball.vx *= scale;
      ball.vy *= scale;
    }

    // Update trail
    ball.trail.push({ x: ball.x, y: ball.y, life: 6 });
    if (ball.trail.length > 8) ball.trail.shift();
    ball.trail.forEach(t => t.life--);
    ball.trail = ball.trail.filter(t => t.life > 0);

    // Wall collisions with proper reflection
    if (ball.x - ball.radius < LEFT_WALL) {
      ball.x = LEFT_WALL + ball.radius;
      ball.vx = Math.abs(ball.vx) * WALL_DAMPING; // Reflect and dampen
    }
    if (ball.x + ball.radius > RIGHT_WALL) {
      ball.x = RIGHT_WALL - ball.radius;
      ball.vx = -Math.abs(ball.vx) * WALL_DAMPING; // Reflect and dampen
    }

    // No more peg collisions since there are no pegs

    // Slot dividers collision
    if (ball.y > SLOT_DIVIDER_TOP - ball.radius && ball.y < SLOT_DIVIDER_BOTTOM + ball.radius) {
      for (let i = 1; i < NUM_SLOTS; i++) {
        const dividerX = slotBoundaries[i];
        const dx = Math.abs(ball.x - dividerX);
        if (dx < ball.radius && ball.y > SLOT_DIVIDER_TOP - ball.radius && ball.y < SLOT_DIVIDER_BOTTOM + ball.radius) {
          if (ball.x < dividerX) {
            ball.x = dividerX - ball.radius;
            ball.vx = -Math.abs(ball.vx) * WALL_DAMPING;
          } else {
            ball.x = dividerX + ball.radius;
            ball.vx = Math.abs(ball.vx) * WALL_DAMPING;
          }
        }
      }
    }

    // Check if ball has landed in a slot
    if (ball.y >= SLOT_BOTTOM_Y) {
      // Determine which slot the ball landed in
      let slotIndex = 0;
      for (let i = 1; i < NUM_SLOTS; i++) {
        if (ball.x < slotBoundaries[i]) { 
          slotIndex = i - 1; 
          break; 
        }
        if (i === NUM_SLOTS - 1 && ball.x >= slotBoundaries[i]) slotIndex = i;
      }
      if (ball.x <= slotBoundaries[0]) slotIndex = 0;
      if (ball.x >= slotBoundaries[NUM_SLOTS]) slotIndex = NUM_SLOTS - 1;

      // Mark ball as inactive and store the slot it landed in
      ball.active = false;
      
      // Add a stationary ball that slowly fades
      landedBallsRef.current.push({
        x: slotCenters[slotIndex],
        y: SLOT_BOTTOM_Y + 12,
        timer: 140,
        opacity: 1,
      });

      // Highlight the winning slot and show message
      setHighlightedSlot(slotIndex);
      setWinMessage(`${PLINKO_SLOTS[slotIndex].multiplier}× WINNER!`);

      // Clear win message after delay
      setTimeout(() => {
        setWinMessage(null);
      }, 2000);
    }

    // Failsafe: remove very old balls
    if (ball.age > 1100) {
      ball.vy += 1.5;
      if (ball.age > 1400) {
        ball.active = false;
      }
    }

    return ball;
  };

  const dropBall = () => {
    if (dropCooldown > 0 || isAnimating) return;
    
    setIsAnimating(true);
    setHighlightedSlot(null);
    setWinMessage(null);
    
    // Create ball with precise center position
    const newBall = createBall(CENTER_DROP_X, PEG_AREA_TOP - 20); // Slightly higher starting point
    
    setBalls(prev => [...prev, newBall]);
    setBallIdCounter(prev => prev + 1);
    setDropCooldown(DROP_COOLDOWN_MAX);
  };

  // Physics simulation loop
  useEffect(() => {
    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = timestamp;
      }
      
      // Calculate delta time in seconds (with clamping to prevent large jumps)
      let deltaTime = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;
      
      // Clamp deltaTime to prevent large physics jumps when tab is unfocused
      deltaTime = Math.min(deltaTime, 0.05); // Maximum 50ms delta
      
      setBalls(prevBalls => {
        let updatedBalls = [...prevBalls];
        
        // Update all active balls with time-based physics
        updatedBalls = updatedBalls.map(ball => {
          if (!ball.active) return ball;
          
          ball.age++;
          
          // Apply gravity with time scaling
          ball.vy += GRAVITY * (deltaTime * 60); // Scale to approximate 60fps behavior
          
          // Update position with time scaling
          ball.x += ball.vx * (deltaTime * 60);
          ball.y += ball.vy * (deltaTime * 60);

          // Limit max speed to prevent balls from going too fast
          const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
          const maxSpeed = 15;
          if (speed > maxSpeed) {
            const scale = maxSpeed / speed;
            ball.vx *= scale;
            ball.vy *= scale;
          }

          // Update trail
          ball.trail.push({ x: ball.x, y: ball.y, life: 6 });
          if (ball.trail.length > 8) ball.trail.shift();
          ball.trail.forEach(t => t.life--);
          ball.trail = ball.trail.filter(t => t.life > 0);

          // Wall collisions with proper reflection
          if (ball.x - ball.radius < LEFT_WALL) {
            ball.x = LEFT_WALL + ball.radius;
            ball.vx = Math.abs(ball.vx) * WALL_DAMPING; // Reflect and dampen
          }
          if (ball.x + ball.radius > RIGHT_WALL) {
            ball.x = RIGHT_WALL - ball.radius;
            ball.vx = -Math.abs(ball.vx) * WALL_DAMPING; // Reflect and dampen
          }

          // No peg collisions since there are no pegs

          // Slot dividers collision
          if (ball.y > SLOT_DIVIDER_TOP - ball.radius && ball.y < SLOT_DIVIDER_BOTTOM + ball.radius) {
            for (let i = 1; i < NUM_SLOTS; i++) {
              const dividerX = slotBoundaries[i];
              const dx = Math.abs(ball.x - dividerX);
              if (dx < ball.radius && ball.y > SLOT_DIVIDER_TOP - ball.radius && ball.y < SLOT_DIVIDER_BOTTOM + ball.radius) {
                if (ball.x < dividerX) {
                  ball.x = dividerX - ball.radius;
                  ball.vx = -Math.abs(ball.vx) * WALL_DAMPING;
                } else {
                  ball.x = dividerX + ball.radius;
                  ball.vx = Math.abs(ball.vx) * WALL_DAMPING;
                }
              }
            }
          }

          // Check if ball has landed in a slot
          if (ball.y >= SLOT_BOTTOM_Y) {
            // Determine which slot the ball landed in
            let slotIndex = 0;
            for (let i = 1; i < NUM_SLOTS; i++) {
              if (ball.x < slotBoundaries[i]) { 
                slotIndex = i - 1; 
                break; 
              }
              if (i === NUM_SLOTS - 1 && ball.x >= slotBoundaries[i]) slotIndex = i;
            }
            if (ball.x <= slotBoundaries[0]) slotIndex = 0;
            if (ball.x >= slotBoundaries[NUM_SLOTS]) slotIndex = NUM_SLOTS - 1;

            // Mark ball as inactive and store the slot it landed in
            ball.active = false;
            
            // Add a stationary ball that slowly fades
            landedBallsRef.current.push({
              x: slotCenters[slotIndex],
              y: SLOT_BOTTOM_Y + 12,
              timer: 140,
              opacity: 1,
            });

            // Highlight the winning slot and show message
            setHighlightedSlot(slotIndex);
            setWinMessage(`${PLINKO_SLOTS[slotIndex].multiplier}× WINNER!`);

            // Clear win message after delay
            setTimeout(() => {
              setWinMessage(null);
            }, 2000);
          }

          // Failsafe: remove very old balls
          if (ball.age > 1100) {
            ball.vy += 1.5;
            if (ball.age > 1400) {
              ball.active = false;
            }
          }

          return ball;
        });
        
        // Update landed balls
        landedBallsRef.current = landedBallsRef.current.map(lb => ({
          ...lb,
          timer: lb.timer - 1,
          opacity: Math.max(0, lb.timer / 140)
        })).filter(lb => lb.timer > 0);
        
        // Since there are no more pegs, we don't need to update peg flash timers
        // pegFlashTimersRef.current remains empty
        
        // Update cooldown
        if (dropCooldown > 0) {
          setDropCooldown(prev => prev - 1);
        }
        
        // Check if any balls are still active
        const activeBalls = updatedBalls.filter(b => b.active);
        if (activeBalls.length === 0) {
          setIsAnimating(false);
        }
        
        return updatedBalls;
      });
      
      // Continue animation if any balls are still active
      if (balls.some((ball: PlinkoBall) => ball.active)) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // All balls have finished, stop animation
        setIsAnimating(false);
      }
    };
    
    if (balls.some((ball: PlinkoBall) => ball.active)) {
      lastTimeRef.current = performance.now();
      animationRef.current = requestAnimationFrame(animate);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [balls, dropCooldown]);

  const clearBoard = () => {
    setBalls([]);
    setWinMessage(null);
    setHighlightedSlot(null);
    landedBallsRef.current = [];
    // No more pegs to clear, so pegFlashTimersRef remains empty
    setDropCooldown(0);
  };

  return (
    <div className="hypnotic-plinko-game w-full max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="font-[family-name:var(--font-gothic)] text-xl text-fuchsia-100 mb-2">Hypnotic Plinko</h2>
        <p className="text-xs text-zinc-400">
          Drop a chip from the center — watch it bounce to a random slot
        </p>
      </div>
      
      <div 
        ref={containerRef}
        className="relative w-full h-96 bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-xl border border-fuchsia-500/30 overflow-hidden mx-auto"
        style={{ maxWidth: '650px', aspectRatio: '650/640' }}
      >
        {/* Center drop indicator */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-xs text-zinc-400 font-medium">
          ⚫ CENTER DROP ⚫
        </div>
        
        {/* Canvas-like visualization of the Plinko board */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-radial from-indigo-900/20 via-purple-900/10 to-zinc-900"></div>
          
          {/* Side walls */}
          <div 
            className="absolute top-10 left-3 w-2 h-80 bg-gradient-to-r from-gray-400/50 to-transparent"
            style={{ width: '3%', height: '80%' }}
          ></div>
          <div 
            className="absolute top-10 right-3 w-2 h-80 bg-gradient-to-l from-gray-400/50 to-transparent"
            style={{ width: '3%', height: '80%' }}
          ></div>
          
          {/* No more pegs - removed peg rendering */}
          
          {/* Balls */}
          {balls.map((ball) => (
            <div
              key={ball.id}
              className="absolute rounded-full bg-gradient-to-br from-orange-300 to-red-500 shadow-lg"
              style={{
                left: `${(ball.x / CANVAS_WIDTH) * 100}%`,
                top: `${(ball.y / CANVAS_HEIGHT) * 100}%`,
                width: '14px',
                height: '14px',
                transform: 'translate(-50%, -50%)',
                boxShadow: '0 0 8px rgba(255, 100, 40, 0.7)',
                zIndex: 10,
                transition: 'none'
              }}
            >
              {/* Ball highlight */}
              <div 
                className="absolute rounded-full bg-white/45"
                style={{
                  width: '4px',
                  height: '4px',
                  left: '2px',
                  top: '2px'
                }}
              ></div>
              
              {/* Ball trail */}
              {ball.trail.map((trailPoint, idx) => (
                <div
                  key={idx}
                  className="absolute rounded-full bg-orange-400/40"
                  style={{
                    left: `${((trailPoint.x - ball.x) / CANVAS_WIDTH) * 100}%`,
                    top: `${((trailPoint.y - ball.y) / CANVAS_HEIGHT) * 100}%`,
                    width: '8px',
                    height: '8px',
                    transform: 'translate(-50%, -50%)',
                    opacity: trailPoint.life / 6 * 0.4
                  }}
                ></div>
              ))}
            </div>
          ))}
          
          {/* Landmarks balls in slots */}
          {landedBallsRef.current.map((landedBall, idx) => (
            <div
              key={idx}
              className="absolute rounded-full bg-gradient-to-br from-amber-300 to-orange-500 shadow-lg"
              style={{
                left: `${(landedBall.x / CANVAS_WIDTH) * 100}%`,
                top: `${(landedBall.y / CANVAS_HEIGHT) * 100}%`,
                width: '12px',
                height: '12px',
                transform: 'translate(-50%, -50%)',
                opacity: landedBall.opacity,
                boxShadow: '0 0 8px rgba(255, 100, 40, 0.7)',
                zIndex: 10
              }}
            >
              <div 
                className="absolute rounded-full bg-white/45"
                style={{
                  width: '3px',
                  height: '3px',
                  left: '1.5px',
                  top: '1.5px'
                }}
              ></div>
            </div>
          ))}
          
          {/* Slots at the bottom */}
          <div 
            className="absolute bottom-0 left-0 right-0 flex h-16"
            style={{ 
              top: `${(SLOT_DIVIDER_TOP / CANVAS_HEIGHT) * 100}%`,
              height: `${((SLOT_BOTTOM_Y + 35 - SLOT_DIVIDER_TOP) / CANVAS_HEIGHT) * 100}%`
            }}
          >
            {PLINKO_SLOTS.map((slot: PlinkoSlot, index: number) => (
              <div
                key={index}
                className={`flex-1 flex flex-col items-center justify-end border-t-2 border-l border-white/20 p-1 text-[9px] transition-all duration-500 ${
                  highlightedSlot === index 
                    ? `${slot.color} ${slot.glowColor} shadow-lg scale-105` 
                    : 'bg-zinc-800/80'
                }`}
              >
                <span className="font-bold text-white">{slot.multiplier}×</span>
              </div>
            ))}
          </div>
          
          {/* Slot dividers */}
          {Array.from({ length: NUM_SLOTS - 1 }).map((_, index) => (
            <div
              key={`divider-${index}`}
              className="absolute top-[75%] w-0.5 h-12 bg-white/50"
              style={{
                left: `${((slotBoundaries[index + 1]) / CANVAS_WIDTH) * 100}%`,
                top: `${(SLOT_DIVIDER_TOP / CANVAS_HEIGHT) * 100}%`,
                height: `${((SLOT_DIVIDER_BOTTOM - SLOT_DIVIDER_TOP) / CANVAS_HEIGHT) * 100}%`
              }}
            ></div>
          ))}
        </div>

        {/* Winner indicator */}
        {winMessage && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xl font-bold text-emerald-400 px-4 py-2 bg-black/50 rounded-lg animate-pulse z-20">
            {winMessage}
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-center gap-4">
        <button
          type="button"
          disabled={dropCooldown > 0}
          onClick={dropBall}
          className="hypnotic-plinko-drop-btn rounded-lg bg-gradient-to-r from-fuchsia-600 to-purple-600 px-6 py-3 font-medium text-white hover:from-fuchsia-500 hover:to-purple-500 disabled:opacity-50 transition-all duration-300 shadow-lg shadow-fuchsia-500/20 hover:shadow-fuchsia-500/30"
        >
          {dropCooldown > 0 ? `Dropping... (${dropCooldown})` : "Drop Chip"}
        </button>
        
        <button
          type="button"
          onClick={clearBoard}
          className="hypnotic-plinko-clear-btn rounded-lg bg-zinc-700 px-6 py-3 font-medium text-zinc-200 hover:bg-zinc-600 border border-zinc-600 transition-all duration-300"
        >
          Clear Board
        </button>
      </div>
    </div>
  );
}