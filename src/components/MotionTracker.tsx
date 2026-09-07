import { useEffect, useRef } from 'react';

import { COLOR_NOTES, frequencyForColorAtHeight } from '../audio/noteMapping';

import { audioEngine } from '../audio/AudioEngine';

type Point = {
    x: number;
    y: number;
};

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

/**
 * How different a pixel must be from the previous frame
 * before we consider it motion.
 */
const MOTION_THRESHOLD = 28;

/**
 * Minimum amount of motion pixels required.
 * Prevents camera noise from becoming a note.
 */
const MIN_MOTION_PIXELS = 30;

/**
 * Ignore blobs smaller than this.
 */
const MIN_BLOB_AREA = 35;

/**
 * Only search for blobs inside this area.
 * Helps ignore tiny changes around the edges.
 */
const BORDER = 3;

/**
 * Point smoothing.
 */
const SMOOTHING = 0.18;

/**
 * Minimum time between notes.
 */
const NOTE_COOLDOWN = 120;

/**
 * A note is triggered when the point enters
 * another horizontal note zone.
 */
const NOTE_ZONES = COLOR_NOTES.length;

/**
 * How much the hand needs to move before another
 * note can be triggered.
 */
const MIN_MOVEMENT_FOR_NOTE = 0.025;

/**
 * Trail length.
 */
const TRAIL_LENGTH = 18;

export default function MotionTracker({
    video,
    width,
    height,
    enabled = true,
    onPointChange
}: MotionTrackerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const previousFrameRef = useRef<Uint8ClampedArray | null>(null);

    const pointRef = useRef<Point | null>(null);

    const previousNotePointRef = useRef<Point | null>(null);

    const lastNoteTimeRef = useRef(0);

    const lastNoteZoneRef = useRef(-1);

    const trailRef = useRef<Point[]>([]);

    useEffect(() => {
        if (!enabled || !video) {
            previousFrameRef.current = null;
            pointRef.current = null;
            previousNotePointRef.current = null;
            trailRef.current = [];

            return;
        }

        const canvas = canvasRef.current;

        if (!canvas) return;

        const ctx = canvas.getContext('2d', {
            willReadFrequently: true
        });

        if (!ctx) return;

        canvas.width = PROCESS_WIDTH;
        canvas.height = PROCESS_HEIGHT;

        let cancelled = false;
        let animationFrame = 0;

        /**
         * Finds connected components in the motion mask.
         *
         * This is basically:
         *
         * pixels
         *   ↓
         * groups of neighboring pixels
         *   ↓
         * blobs
         *   ↓
         * largest blob
         */
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

                    if (mask[startIndex] === 0 || visited[startIndex]) {
                        continue;
                    }

                    const queue: number[] = [startIndex];

                    visited[startIndex] = 1;

                    let pixelCount = 0;

                    let minX = x;
                    let maxX = x;
                    let minY = y;
                    let maxY = y;

                    let sumX = 0;
                    let sumY = 0;

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
                            ) {
                                continue;
                            }

                            const nextIndex = nextY * PROCESS_WIDTH + nextX;

                            if (mask[nextIndex] === 1 && visited[nextIndex] === 0) {
                                visited[nextIndex] = 1;
                                queue.push(nextIndex);
                            }
                        }
                    }

                    if (pixelCount < MIN_BLOB_AREA) {
                        continue;
                    }

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

            /**
             * Build motion mask.
             */
            for (let y = BORDER; y < PROCESS_HEIGHT - BORDER; y++) {
                for (let x = BORDER; x < PROCESS_WIDTH - BORDER; x++) {
                    const i = (y * PROCESS_WIDTH + x) * 4;

                    const currentR = current[i];
                    const currentG = current[i + 1];
                    const currentB = current[i + 2];

                    const previousR = previous[i];
                    const previousG = previous[i + 1];
                    const previousB = previous[i + 2];

                    const diff =
                        Math.abs(currentR - previousR) +
                        Math.abs(currentG - previousG) +
                        Math.abs(currentB - previousB);

                    const averageDiff = diff / 3;

                    if (averageDiff > MOTION_THRESHOLD) {
                        mask[y * PROCESS_WIDTH + x] = 1;
                        totalMotionPixels++;
                    }
                }
            }

            previousFrameRef.current = new Uint8ClampedArray(current);

            if (totalMotionPixels < MIN_MOTION_PIXELS) {
                return;
            }

            /**
             * Find independent moving areas.
             */
            const blobs = findMotionBlobs(mask);

            if (blobs.length === 0) {
                return;
            }

            /**
             * Pick the largest meaningful blob.
             *
             * Usually this will be the hand/body movement
             * rather than random camera noise.
             */
            blobs.sort((a, b) => b.area - a.area);

            const blob = blobs[0];

            const rawPoint: Point = {
                x: blob.centerX / PROCESS_WIDTH,

                y: blob.centerY / PROCESS_HEIGHT
            };

            /**
             * Smooth tracking point.
             */
            const previousPoint = pointRef.current;

            const point: Point =
                previousPoint === null
                    ? rawPoint
                    : {
                          x: previousPoint.x + (rawPoint.x - previousPoint.x) * SMOOTHING,

                          y: previousPoint.y + (rawPoint.y - previousPoint.y) * SMOOTHING
                      };

            pointRef.current = point;

            /**
             * Trail.
             */
            trailRef.current.push(point);

            if (trailRef.current.length > TRAIL_LENGTH) {
                trailRef.current.shift();
            }

            onPointChange?.(point);

            /**
             * -----------------------------------------
             * MUSIC
             * -----------------------------------------
             */

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

            /**
             * Play only when:
             *
             * 1. user actually moved
             * 2. entered another note zone
             * 3. cooldown passed
             */
            if (movedEnough && zoneChanged && cooldownPassed) {
                const color = COLOR_NOTES[noteZone].color;

                /**
                 * Higher position = higher pitch.
                 */
                const height = 1 - point.y;

                const frequency = frequencyForColorAtHeight(color, height);

                audioEngine.playNote(frequency);

                lastNoteTimeRef.current = now;

                lastNoteZoneRef.current = noteZone;

                previousNotePointRef.current = {
                    ...point
                };
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
        };
    }, [video, enabled, onPointChange]);

    const point = pointRef.current;

    return (
        <>
            {/* Processing canvas */}
            <canvas
                ref={canvasRef}
                style={{
                    display: 'none'
                }}
            />

            {/* Tracking visualization */}
            {enabled && point && (
                <div
                    className='motion-tracker'
                    style={{
                        position: 'absolute',
                        inset: 0,
                        pointerEvents: 'none',
                        overflow: 'hidden'
                    }}
                >
                    {/* Trail */}
                    {trailRef.current.map((trailPoint, index) => {
                        const opacity = (index + 1) / trailRef.current.length;

                        return (
                            <div
                                key={index}
                                style={{
                                    position: 'absolute',
                                    left: `${trailPoint.x * width}px`,
                                    top: `${trailPoint.y * height}px`,
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    background: 'white',
                                    opacity: opacity * 0.3,
                                    transform: 'translate(-50%, -50%)'
                                }}
                            />
                        );
                    })}

                    {/* Main point */}
                    <div
                        style={{
                            position: 'absolute',
                            left: `${point.x * width}px`,
                            top: `${point.y * height}px`,
                            width: 28,
                            height: 28,
                            border: '2px solid white',
                            borderRadius: '50%',
                            transform: 'translate(-50%, -50%)',
                            boxShadow: '0 0 20px rgba(255,255,255,0.8)'
                        }}
                    />

                    <div
                        style={{
                            position: 'absolute',
                            left: `${point.x * width}px`,
                            top: `${point.y * height}px`,
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: 'white',
                            transform: 'translate(-50%, -50%)'
                        }}
                    />
                </div>
            )}
        </>
    );
}
