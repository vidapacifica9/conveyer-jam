import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { ConveyorGameEngine } from '../game/gameEngine';
import { renderGame } from '../game/renderer';
import { GameSnapshot, GameTheme } from '../types/game';

export interface GameCanvasHandle {
  activateMagnet: () => void;
  activateFreeze: () => void;
  addBonusTime: (seconds: number) => void;
}

interface GameCanvasProps {
  levelNumber: number;
  resetToken: number;
  theme: GameTheme;
  onSnapshotChange: (snapshot: GameSnapshot) => void;
}

export const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(
  ({ levelNumber, resetToken, theme, onSnapshotChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<ConveyorGameEngine | null>(null);
    const callbackRef = useRef(onSnapshotChange);
    callbackRef.current = onSnapshotChange;

    useImperativeHandle(ref, () => ({
      activateMagnet: () => engineRef.current?.activateMagnet(6),
      activateFreeze: () => engineRef.current?.activateFreeze(5),
      addBonusTime: (seconds: number) => engineRef.current?.addBonusTime(seconds),
    }));

    // Initialize engine and animation loop
    useEffect(() => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const rect = container.getBoundingClientRect();
      const width = rect.width || 390;
      const height = rect.height || 760;

      const engine = new ConveyorGameEngine(levelNumber, width, height, (snap) => {
        callbackRef.current(snap);
      });
      engineRef.current = engine;
      callbackRef.current(engine.getSnapshot());

      const syncSize = () => {
        const r = container.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        canvas.width = Math.floor(r.width * dpr);
        canvas.height = Math.floor(r.height * dpr);
        canvas.style.width = `${r.width}px`;
        canvas.style.height = `${r.height}px`;
        engine.resize(r.width, r.height);
      };

      syncSize();
      const ro = new ResizeObserver(syncSize);
      ro.observe(container);

      let rafId = 0;
      let lastTime = performance.now();

      const loop = (now: number) => {
        const dt = (now - lastTime) / 1000;
        lastTime = now;

        engine.update(dt);

        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
          ctx.save();
          ctx.scale(dpr, dpr);
          renderGame(ctx, engine);
          ctx.restore();
        }

        rafId = requestAnimationFrame(loop);
      };

      rafId = requestAnimationFrame(loop);

      return () => {
        cancelAnimationFrame(rafId);
        ro.disconnect();
        engineRef.current = null;
      };
    }, []);

    // Reload level when levelNumber or resetToken changes
    useEffect(() => {
      if (engineRef.current) {
        engineRef.current.loadLevel(levelNumber);
      }
    }, [levelNumber, resetToken]);

    // Sync theme without resetting level
    useEffect(() => {
      if (engineRef.current) {
        engineRef.current.setTheme(theme);
      }
    }, [theme]);

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      const engine = engineRef.current;
      if (!canvas || !engine) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      engine.handleTap(x, y);
    };

    return (
      <div ref={containerRef} className="relative w-full h-full overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          className="block w-full h-full cursor-pointer touch-none"
        />
      </div>
    );
  }
);
