import { useEffect, useRef } from "react";
import type { DrawnLine, Point } from "../drawing/Line";
import { createLine } from "../drawing/Line";

type Props = {
  width: number;
  height: number;
  lines: DrawnLine[];
  activeColor: string;
  onStrokeStart: () => void;
  onLineComplete: (line: DrawnLine) => void;
};

const STROKE_WIDTH = 5;

function drawLine(ctx: CanvasRenderingContext2D, line: DrawnLine) {
  if (line.points.length === 0) return;
  ctx.strokeStyle = line.color;
  ctx.lineWidth = STROKE_WIDTH;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = line.color;
  ctx.shadowBlur = 10;

  if (line.points.length === 1) {
    const [p] = line.points;
    ctx.beginPath();
    ctx.arc(p.x, p.y, STROKE_WIDTH / 2, 0, Math.PI * 2);
    ctx.fillStyle = line.color;
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(line.points[0].x, line.points[0].y);
  for (let i = 1; i < line.points.length; i++) {
    ctx.lineTo(line.points[i].x, line.points[i].y);
  }
  ctx.stroke();
}

export default function DrawingCanvas({
  width,
  height,
  lines,
  activeColor,
  onStrokeStart,
  onLineComplete,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef<DrawnLine | null>(null);
  const pointerIdRef = useRef<number | null>(null);

  // Full redraw whenever the committed line list or the canvas size changes
  // (resize, orientation change, clear button, or a stroke being committed).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    for (const line of lines) drawLine(ctx, line);
  }, [lines, width, height]);

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    onStrokeStart();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    pointerIdRef.current = e.pointerId;

    const point = getPoint(e);
    const line = createLine(activeColor, point);
    drawingRef.current = line;

    const ctx = canvas.getContext("2d");
    if (ctx) drawLine(ctx, line);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (pointerIdRef.current !== e.pointerId) return;
    const line = drawingRef.current;
    const canvas = canvasRef.current;
    if (!line || !canvas) return;

    const point = getPoint(e);
    const prev = line.points[line.points.length - 1];
    line.points.push(point);

    const ctx = canvas.getContext("2d");
    if (ctx && prev) {
      ctx.strokeStyle = line.color;
      ctx.lineWidth = STROKE_WIDTH;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = line.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
  }

  function finishStroke() {
    const line = drawingRef.current;
    drawingRef.current = null;
    pointerIdRef.current = null;
    if (line && line.points.length >= 2) {
      onLineComplete(line);
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className="drawing-canvas"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishStroke}
      onPointerLeave={finishStroke}
      onPointerCancel={finishStroke}
    />
  );
}
