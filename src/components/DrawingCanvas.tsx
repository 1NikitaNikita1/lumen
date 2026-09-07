import { useEffect, useRef } from 'react';
import type { DrawnLine, Point } from '../drawing/Line';
import { createLine } from '../drawing/Line';
import { audioEngine } from '../audio/AudioEngine';
import { DEFAULT_COLOR_CONFIGS, frequencyFromConfig, type ColorConfigs } from './ColorControls';

type Props = {
    width: number;
    height: number;
    lines: DrawnLine[];
    activeColor: string;
    colorConfigs?: ColorConfigs;
    onStrokeStart: () => void;
    onLineComplete: (line: DrawnLine) => void;
};

const STROKE_WIDTH = 5;
const NOTE_COOLDOWN = 180;
const MOVEMENT_THRESHOLD = 0.004;
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function drawLine(ctx: CanvasRenderingContext2D, line: DrawnLine) {
    if (line.points.length === 0) return;
    ctx.strokeStyle = line.color;
    ctx.lineWidth = STROKE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
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
    colorConfigs = DEFAULT_COLOR_CONFIGS,
    onStrokeStart,
    onLineComplete
}: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef<DrawnLine | null>(null);
    const pointerIdRef = useRef<number | null>(null);
    const lastTriggerRef = useRef(0);
    const configsRef = useRef(colorConfigs);

    useEffect(() => {
        configsRef.current = colorConfigs;
    }, [colorConfigs]);

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
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        for (const line of lines) drawLine(ctx, line);
    }, [lines, width, height]);

    function getPoint(e: React.PointerEvent<HTMLCanvasElement>): Point {
        const rect = e.currentTarget.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    // Live-plays a note for this segment of the stroke, the same way
    // TargetTracker plays a note as a finger moves: movement threshold,
    // a cooldown so it doesn't spam, a y-based scale index, and
    // velocity/pan derived from how the point moved.
    function maybeTriggerNote(color: string, prev: Point, point: Point) {
        const config = configsRef.current[color];
        if (!config || !config.enabled) return;

        const movement = distance(point, prev);
        if (movement < Math.max(width, height) * MOVEMENT_THRESHOLD) return;

        const now = performance.now();
        if (now - lastTriggerRef.current < NOTE_COOLDOWN) return;

        const normalizedY = point.y / height;
        const normalizedX = point.x / width;
        const scaleIndex = Math.min(SCALE.length - 1, Math.floor((1 - normalizedY) * SCALE.length));

        const baseFrequency = frequencyFromConfig(config);
        const frequency = baseFrequency * Math.pow(2, SCALE[scaleIndex] / 12);

        const normalizedMovement = movement / Math.max(width, height);
        const velocity = Math.min(0.8, 0.3 + normalizedMovement * 8);
        const pan = normalizedX * 2 - 1;

        audioEngine.init();
        audioEngine.playNote(frequency, velocity * config.volume, pan);
        lastTriggerRef.current = now;
    }

    function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
        onStrokeStart();
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.setPointerCapture(e.pointerId);
        pointerIdRef.current = e.pointerId;
        lastTriggerRef.current = 0;

        const point = getPoint(e);
        const line = createLine(activeColor, point);
        drawingRef.current = line;

        const ctx = canvas.getContext('2d');
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

        const ctx = canvas.getContext('2d');
        if (ctx && prev) {
            ctx.strokeStyle = line.color;
            ctx.lineWidth = STROKE_WIDTH;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowColor = line.color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(point.x, point.y);
            ctx.stroke();
        }

        if (prev) maybeTriggerNote(line.color, prev, point);
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
            className='drawing-canvas'
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishStroke}
            onPointerLeave={finishStroke}
            onPointerCancel={finishStroke}
        />
    );
}
