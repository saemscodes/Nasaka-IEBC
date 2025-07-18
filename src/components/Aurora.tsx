
import React, { useEffect, useRef } from 'react';

interface AuroraProps {
  colorStops: string[];
  blend?: number;
  amplitude?: number;
  speed?: number;
  className?: string;
}

const Aurora: React.FC<AuroraProps> = ({
  colorStops,
  blend = 0.5,
  amplitude = 1.0,
  speed = 0.5,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Create gradient with animated positions
      const gradient = ctx.createLinearGradient(
        0, 
        Math.sin(time * speed) * amplitude * 100,
        canvas.width,
        canvas.height + Math.cos(time * speed * 0.8) * amplitude * 150
      );

      colorStops.forEach((color, index) => {
        const position = index / (colorStops.length - 1);
        const animatedPosition = position + Math.sin(time * speed + position * Math.PI) * 0.1;
        gradient.addColorStop(Math.max(0, Math.min(1, animatedPosition)), color);
      });

      // Apply gradient with blend mode
      ctx.globalAlpha = blend;
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      time += 0.01;
      animationRef.current = requestAnimationFrame(animate);
    };

    resize();
    animate();

    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [colorStops, blend, amplitude, speed]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 ${className}`}
      style={{ pointerEvents: 'none' }}
    />
  );
};

export default Aurora;
