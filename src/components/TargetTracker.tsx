import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from '@mediapipe/tasks-vision';

import { COLOR_NOTES, frequencyForColorAtHeight } from '../audio/noteMapping';
import { audioEngine } from '../audio/AudioEngine';

type Props = {
    width: number;
    height: number;
    enabled?: boolean;
};

type Point = {
    x: number;
    y: number;
};

const MODEL_URL =
    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const FINGER_TIPS = [4, 8, 12, 16, 20];

const MIN_MOVEMENT = 0.008;
const NOTE_COOLDOWN = 120;
const SMOOTHING = 0.35;

export default function TargetTracker({ width, height, enabled = true }: Props) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const landmarkerRef = useRef<HandLandmarker | null>(null);
    const animationRef = useRef<number | null>(null);

    const previousPointRef = useRef<Point | null>(null);
    const smoothPointRef = useRef<Point | null>(null);

    const lastVideoTimeRef = useRef(-1);
    const lastNoteTimeRef = useRef(0);

    const [ready, setReady] = useState(false);

    /*
     * Initialize MediaPipe.
     *
     * IMPORTANT:
     * The WASM files are imported from the npm package instead of
     * loading them from jsDelivr.
     */
    useEffect(() => {
        if (!enabled) return;

        let cancelled = false;
        let landmarker: HandLandmarker | null = null;

        async function init() {
            try {
                const vision = await FilesetResolver.forVisionTasks('/mediapipe');

                landmarker = await HandLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: MODEL_URL,
                        delegate: 'GPU'
                    },

                    runningMode: 'VIDEO',
                    numHands: 1,

                    minHandDetectionConfidence: 0.5,
                    minHandPresenceConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });

                if (cancelled) {
                    landmarker.close();
                    return;
                }

                landmarkerRef.current = landmarker;
                setReady(true);

                console.log('MediaPipe HandLandmarker ready');
            } catch (error) {
                console.error('Failed to initialize MediaPipe:', error);
            }
        }
        void init();

        return () => {
            cancelled = true;

            if (animationRef.current !== null) {
                cancelAnimationFrame(animationRef.current);
            }

            landmarkerRef.current?.close();
            landmarkerRef.current = null;
        };
    }, [enabled]);

    /*
     * Tracking loop.
     */
    useEffect(() => {
        if (!enabled || !ready) return;

        const canvas = canvasRef.current;

        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        if (!ctx) return;

        canvas.width = width;
        canvas.height = height;

        const detect = () => {
            const video = document.querySelector('.camera-video') as HTMLVideoElement | null;

            const landmarker = landmarkerRef.current;

            if (!video || !landmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
                animationRef.current = requestAnimationFrame(detect);

                return;
            }

            /*
             * Don't process the same video frame twice.
             */
            if (video.currentTime === lastVideoTimeRef.current) {
                animationRef.current = requestAnimationFrame(detect);

                return;
            }

            lastVideoTimeRef.current = video.currentTime;

            let result: HandLandmarkerResult;

            try {
                result = landmarker.detectForVideo(video, performance.now());
            } catch (error) {
                console.error('Hand detection error:', error);

                animationRef.current = requestAnimationFrame(detect);

                return;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            /*
             * No hand.
             */
            if (!result.landmarks.length) {
                previousPointRef.current = null;
                smoothPointRef.current = null;

                animationRef.current = requestAnimationFrame(detect);

                return;
            }

            const hand = result.landmarks[0];

            /*
             * Automatically select index fingertip.
             *
             * Landmark 8 = index finger tip.
             *
             * We intentionally use the index finger instead
             * of trying to guess between all fingertips.
             */
            const target = hand[8];

            if (!target) {
                animationRef.current = requestAnimationFrame(detect);

                return;
            }

            /*
             * Camera is mirrored visually.
             */
            const normalizedX = 1 - target.x;
            const normalizedY = target.y;

            const rawPoint: Point = {
                x: normalizedX * width,
                y: normalizedY * height
            };

            /*
             * Smooth movement.
             */
            const previousSmooth = smoothPointRef.current;

            const smoothPoint: Point = previousSmooth
                ? {
                      x: previousSmooth.x + (rawPoint.x - previousSmooth.x) * SMOOTHING,

                      y: previousSmooth.y + (rawPoint.y - previousSmooth.y) * SMOOTHING
                  }
                : rawPoint;

            smoothPointRef.current = smoothPoint;

            /*
             * Draw target point.
             */
            ctx.beginPath();

            ctx.arc(smoothPoint.x, smoothPoint.y, 10, 0, Math.PI * 2);

            ctx.fillStyle = 'rgba(255,255,255,0.95)';

            ctx.fill();

            ctx.beginPath();

            ctx.arc(smoothPoint.x, smoothPoint.y, 22, 0, Math.PI * 2);

            ctx.strokeStyle = 'rgba(255,255,255,0.45)';

            ctx.lineWidth = 2;

            ctx.stroke();

            /*
             * Detect movement.
             */
            const previous = previousPointRef.current;

            if (previous) {
                const dx = smoothPoint.x - previous.x;

                const dy = smoothPoint.y - previous.y;

                const distance = Math.sqrt(dx * dx + dy * dy);

                const normalizedMovement = distance / Math.max(width, height);

                if (normalizedMovement > MIN_MOVEMENT) {
                    const now = performance.now();

                    if (now - lastNoteTimeRef.current > NOTE_COOLDOWN) {
                        /*
                         * X -> one of six notes.
                         */
                        const zone = Math.min(
                            COLOR_NOTES.length - 1,

                            Math.floor(normalizedX * COLOR_NOTES.length)
                        );

                        const color = COLOR_NOTES[zone].color;

                        /*
                         * Y -> octave / pitch.
                         */
                        const frequency = frequencyForColorAtHeight(color, 1 - normalizedY);

                        audioEngine.init();

                        audioEngine.playNote(frequency);

                        lastNoteTimeRef.current = now;
                    }
                }
            }

            previousPointRef.current = smoothPoint;

            animationRef.current = requestAnimationFrame(detect);
        };

        animationRef.current = requestAnimationFrame(detect);

        return () => {
            if (animationRef.current !== null) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [enabled, ready, width, height]);

    return (
        <canvas
            ref={canvasRef}
            className='target-tracker'
            width={width}
            height={height}
            style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 5
            }}
        />
    );
}
