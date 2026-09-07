import { useEffect, useRef } from "react";
import type { DrawnLine } from "../drawing/Line";
import { findCrossings, type Crossing } from "../drawing/collisionDetection";

type Props = {
  width: number;
  height: number;
  lines: DrawnLine[];
  /** Pixels per second. */
  speed: number;
  isPlaying: boolean;
  onCrossing: (crossing: Crossing) => void;
};

const SCANNER_COLOR = "#F5F7FA";

export default function Scanner({ width, height, lines, speed, isPlaying, onCrossing }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const xRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Keep the latest props available inside the persistent animation loop
  // without needing to tear the loop down and restart it on every change.
  const linesRef = useRef(lines);
  const speedRef = useRef(speed);
  const onCrossingRef = useRef(onCrossing);
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    onCrossingRef.current = onCrossing;
  }, [onCrossing]);

  function drawScannerAt(x: number) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(245, 247, 250, 0.05)");
    gradient.addColorStop(0.5, SCANNER_COLOR);
    gradient.addColorStop(1, "rgba(245, 247, 250, 0.05)");

    ctx.save();
    ctx.shadowColor = SCANNER_COLOR;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    ctx.restore();
  }

  // Resize the backing canvas whenever the viewport changes, keeping the
  // scanner's x position sane relative to the new width.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (xRef.current > width) xRef.current = 0;
    drawScannerAt(xRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  // The animation loop itself only needs to restart when play state changes.
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTimeRef.current = null;
      return;
    }

    function tick(now: number) {
      if (lastTimeRef.current === null) lastTimeRef.current = now;
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      const prevX = xRef.current;
      let nextX = prevX + speedRef.current * dt;

      if (nextX >= width) {
        nextX = width > 0 ? nextX % width : 0;
      }

      const crossings = findCrossings(linesRef.current, prevX, nextX, width);
      for (const crossing of crossings) onCrossingRef.current(crossing);

      xRef.current = nextX;
      drawScannerAt(nextX);
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTimeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, width, height]);

  return <canvas ref={canvasRef} className="scanner-canvas" />;
}
