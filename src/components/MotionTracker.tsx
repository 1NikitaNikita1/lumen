import { useEffect, useRef } from 'react';
import { COLOR_NOTES, frequencyForColorAtHeight } from '../audio/noteMapping';
import { audioEngine } from '../audio/AudioEngine';

type Point = { x: number; y: number };

type MotionTrackerProps = {
    video: HTMLVideoElement | null;
    width: number;
    height: number;
    enabled?: boolean;
    onPointChange?: (point: Point) => void;
};

type MotionBlob = {
    x: number;
    y: number;
    width: number;
    height: number;
    area: number;
    centerX: number;
    centerY: number;
};

const PROCESS_WIDTH = 160;
const PROCESS_HEIGHT = 120;
const MOTION_THRESHOLD = 28;
const MIN_MOTION_PIXELS = 30;
const MIN_BLOB_AREA = 35;
const BORDER = 3;
const SMOOTHING = 0.18;
const NOTE_COOLDOWN = 120;
const NOTE_ZONES = COLOR_NOTES.length;
const MIN_MOVEMENT_FOR_NOTE = 0.025;
const TRAIL_LENGTH = 18;

export default function MotionTracker({
    video,
    width,
    height,
    enabled = true,
    onPointChange
}: MotionTrackerProps) {
    const processCanvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

    const previousFrameRef = useRef<Uint8ClampedArray | null>(null);
    const pointRef = useRef<Point | null>(null);
    const previousNotePointRef = useRef<Point | null>(null);
    const lastNoteTimeRef = useRef(0);
    const lastNoteZoneRef = useRef(-1);
    const trailRef = useRef<Point[]>([]);

    // Keep the overlay canvas sized to the viewport, independent of the
    // small offscreen canvas used for motion analysis.
    useEffect(() => {
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;
        canvas.width = width;
        canvas.height = height;
    }, [width, height]);

    function drawOverlay() {
        const canvas = overlayCanvasRef.current;
        const ctx = canvas?.getContext('2d');
        const point = pointRef.current;
        if (!canvas || !ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!point) return;

        const trail = trailRef.current;
        trail.forEach((trailPoint, index) => {
            const opacity = ((index + 1) / trail.length) * 0.3;
            ctx.beginPath();
            ctx.arc(trailPoint.x * width, trailPoint.y * height, 3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${opacity})`;
            ctx.fill();
        });

        const px = point.x * width;
        const py = point.y * height;

        ctx.beginPath();
        ctx.arc(px, py, 14, 0, Math.PI * 2);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(255,255,255,0.8)';
        ctx.shadowBlur = 20;
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
    }

    useEffect(() => {
        if (!enabled || !video) {
            previousFrameRef.current = null;
            pointRef.current = null;
            previousNotePointRef.current = null;
            trailRef.current = [];
            drawOverlay();
            return;
        }

        const canvas = processCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        canvas.width = PROCESS_WIDTH;
        canvas.height = PROCESS_HEIGHT;

        let cancelled = false;
        let animationFrame = 0;

        const findMotionBlobs = (mask: Uint8Array): MotionBlob[] => {
            const visited = new Uint8Array(PROCESS_WIDTH * PROCESS_HEIGHT);
            const blobs: MotionBlob[] = [];
            const directions = [
                [-1, -1],
                [0, -1],
                [1, -1],
                [-1, 0],
                [1, 0],
                [-1, 1],
                [0, 1],
                [1, 1]
            ];

            for (let y = BORDER; y < PROCESS_HEIGHT - BORDER; y++) {
                for (let x = BORDER; x < PROCESS_WIDTH - BORDER; x++) {
                    const startIndex = y * PROCESS_WIDTH + x;
                    if (mask[startIndex] === 0 || visited[startIndex]) continue;

                    const queue: number[] = [startIndex];
                    visited[startIndex] = 1;

                    let pixelCount = 0;
                    let minX = x,
                        maxX = x,
                        minY = y,
                        maxY = y;
                    let sumX = 0,
                        sumY = 0;

                    while (queue.length > 0) {
                        const index = queue.pop()!;
                        const currentX = index % PROCESS_WIDTH;
                        const currentY = Math.floor(index / PROCESS_WIDTH);

                        pixelCount++;
                        sumX += currentX;
                        sumY += currentY;
                        minX = Math.min(minX, currentX);
                        maxX = Math.max(maxX, currentX);
                        minY = Math.min(minY, currentY);
                        maxY = Math.max(maxY, currentY);

                        for (const [dx, dy] of directions) {
                            const nextX = currentX + dx;
                            const nextY = currentY + dy;
                            if (
                                nextX < BORDER ||
                                nextX >= PROCESS_WIDTH - BORDER ||
                                nextY < BORDER ||
                                nextY >= PROCESS_HEIGHT - BORDER
                            )
                                continue;

                            const nextIndex = nextY * PROCESS_WIDTH + nextX;
                            if (mask[nextIndex] === 1 && visited[nextIndex] === 0) {
                                visited[nextIndex] = 1;
                                queue.push(nextIndex);
                            }
                        }
                    }

                    if (pixelCount < MIN_BLOB_AREA) continue;

                    blobs.push({
                        x: minX,
                        y: minY,
                        width: maxX - minX + 1,
                        height: maxY - minY + 1,
                        area: pixelCount,
                        centerX: sumX / pixelCount,
                        centerY: sumY / pixelCount
                    });
                }
            }

            return blobs;
        };

        const processFrame = () => {
            if (cancelled) return;
            animationFrame = requestAnimationFrame(processFrame);

            if (
                video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
                video.videoWidth === 0 ||
                video.videoHeight === 0
            ) {
                return;
            }

            ctx.drawImage(video, 0, 0, PROCESS_WIDTH, PROCESS_HEIGHT);
            const image = ctx.getImageData(0, 0, PROCESS_WIDTH, PROCESS_HEIGHT);
            const current = image.data;
            const previous = previousFrameRef.current;

            if (!previous) {
                previousFrameRef.current = new Uint8ClampedArray(current);
                return;
            }

            const mask = new Uint8Array(PROCESS_WIDTH * PROCESS_HEIGHT);
            let totalMotionPixels = 0;

            for (let y = BORDER; y < PROCESS_HEIGHT - BORDER; y++) {
                for (let x = BORDER; x < PROCESS_WIDTH - BORDER; x++) {
                    const i = (y * PROCESS_WIDTH + x) * 4;
                    const diff =
                        Math.abs(current[i] - previous[i]) +
                        Math.abs(current[i + 1] - previous[i + 1]) +
                        Math.abs(current[i + 2] - previous[i + 2]);
                    if (diff / 3 > MOTION_THRESHOLD) {
                        mask[y * PROCESS_WIDTH + x] = 1;
                        totalMotionPixels++;
                    }
                }
            }

            previousFrameRef.current = new Uint8ClampedArray(current);
            if (totalMotionPixels < MIN_MOTION_PIXELS) return;

            const blobs = findMotionBlobs(mask);
            if (blobs.length === 0) return;

            blobs.sort((a, b) => b.area - a.area);
            const blob = blobs[0];

            const rawPoint: Point = { x: blob.centerX / PROCESS_WIDTH, y: blob.centerY / PROCESS_HEIGHT };
            const previousPoint = pointRef.current;

            const point: Point =
                previousPoint === null
                    ? rawPoint
                    : {
                          x: previousPoint.x + (rawPoint.x - previousPoint.x) * SMOOTHING,
                          y: previousPoint.y + (rawPoint.y - previousPoint.y) * SMOOTHING
                      };

            pointRef.current = point;

            trailRef.current.push(point);
            if (trailRef.current.length > TRAIL_LENGTH) trailRef.current.shift();

            onPointChange?.(point);
            drawOverlay();

            const noteZone = Math.min(NOTE_ZONES - 1, Math.floor(point.x * NOTE_ZONES));
            const previousNotePoint = previousNotePointRef.current;
            const movement =
                previousNotePoint === null
                    ? Infinity
                    : Math.sqrt(
                          Math.pow(point.x - previousNotePoint.x, 2) + Math.pow(point.y - previousNotePoint.y, 2)
                      );

            const now = performance.now();
            const cooldownPassed = now - lastNoteTimeRef.current >= NOTE_COOLDOWN;
            const movedEnough = movement >= MIN_MOVEMENT_FOR_NOTE;
            const zoneChanged = noteZone !== lastNoteZoneRef.current;

            if (movedEnough && zoneChanged && cooldownPassed) {
                const color = COLOR_NOTES[noteZone].color;
                const heightFraction = 1 - point.y;
                const frequency = frequencyForColorAtHeight(color, heightFraction);

                audioEngine.playNote(frequency);
                lastNoteTimeRef.current = now;
                lastNoteZoneRef.current = noteZone;
                previousNotePointRef.current = { ...point };
            }
        };

        processFrame();

        return () => {
            cancelled = true;
            cancelAnimationFrame(animationFrame);
            previousFrameRef.current = null;
            pointRef.current = null;
            previousNotePointRef.current = null;
            trailRef.current = [];
            drawOverlay();
        };
    }, [video, enabled, onPointChange, width, height]);

    return (
        <>
            <canvas ref={processCanvasRef} style={{ display: 'none' }} />
            <canvas
                ref={overlayCanvasRef}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            />
        </>
    );
}
