import { useState, useEffect, useRef } from 'react';

interface Pin {
  x: number;
  y: number;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

const PlinkoGame = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [ball, setBall] = useState<Ball | null>(null);
  const [isDropping, setIsDropping] = useState(false);

  // Generate pins in a triangular grid pattern
  useEffect(() => {
    const generatePins = () => {
      const rows = 10;
      const cols = 15;
      const spacing = 40;
      const startX = 50;
      const startY = 80;
      const pins: Pin[] = [];

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols - row; col++) {
          const x = startX + col * spacing + (row % 2) * spacing / 2;
          const y = startY + row * spacing;
          pins.push({ x, y });
        }
      }

      setPins(pins);
    };

    generatePins();
  }, []);

  // Initialize ball drop
  const startDrop = () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const centerX = canvas.width / 2;
    const ballRadius = 10;

    setBall({
      x: centerX,
      y: 50,
      vx: 0,
      vy: 0,
      radius: ballRadius,
    });

    setIsDropping(true);
    animate();
  };

  // Animation loop with physics
  const animate = () => {
    if (!canvasRef.current || !ball) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw pins
    pins.forEach(pin => {
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.closePath();
    });

    // Update ball physics
    setBall(prev => {
      if (!prev) return prev;

      let { x, y, vx, vy, radius } = prev;

      // Gravity
      vy += 0.5;

      // Damping
      vx *= 0.98;
      vy *= 0.98;

      // Move ball
      x += vx;
      y += vy;

      // Check collisions with pins
      pins.forEach(pin => {
        const dx = x - pin.x;
        const dy = y - pin.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < radius + 8) {
          // Collision response
          const angle = Math.atan2(dy, dx);
          const speed = Math.sqrt(vx * vx + vy * vy);
          const newVx = speed * Math.cos(angle + Math.PI);
          const newVy = speed * Math.sin(angle + Math.PI);

          vx = newVx;
          vy = newVy;

          // Push ball away from pin
          x = pin.x + (radius + 8) * Math.cos(angle);
          y = pin.y + (radius + 8) * Math.sin(angle);
        }
      });

      // Check boundaries
      if (x - radius < 0) {
        x = radius;
        vx *= -0.7;
      }
      if (x + radius > canvas.width) {
        x = canvas.width - radius;
        vx *= -0.7;
      }
      if (y + radius > canvas.height) {
        y = canvas.height - radius;
        vy *= -0.7;
      }

      return { x, y, vx, vy, radius };
    });

    // Draw ball
    if (ball) {
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#00ff00';
      ctx.fill();
      ctx.closePath();
    }

    // Continue animation
    animationRef.current = requestAnimationFrame(animate);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div className="plinko-game">
      <canvas
        ref={canvasRef}
        width={600}
        height={600}
        style={{ border: '1px solid #ccc', background: '#000' }}
      />
      <button onClick={startDrop} disabled={isDropping}>
        {isDropping ? 'DROPPING...' : 'DROP BALL'}
      </button>
    </div>
  );
};

export default PlinkoGame;