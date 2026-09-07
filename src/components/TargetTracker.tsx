import { useEffect, useRef } from 'react';

import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from '@mediapipe/tasks-vision';

import { audioEngine } from '../audio/AudioEngine';

import {
    type FingerConfig,
    type FingerConfigs,
    type FingerName,
    DEFAULT_FINGER_CONFIGS,
    frequencyFromConfig
} from './FingerControls';

type Props = {
    width: number;
    height: number;
    enabled?: boolean;
    fingerConfigs?: FingerConfigs;
};

type Point = {
    x: number;
    y: number;
};

type FingerState = {
    point: Point | null;
    lastTrigger: number;
};

const NOTE_COOLDOWN = 180;
const MOVEMENT_THRESHOLD = 0.004;

const FINGERS: {
    name: FingerName;
    index: number;
}[] = [
    {
        name: 'thumb',
        index: 4
    },
    {
        name: 'index',
        index: 8
    },
    {
        name: 'middle',
        index: 12
    },
    {
        name: 'ring',
        index: 16
    },
    {
        name: 'pinky',
        index: 20
    }
];

const createFingerState = (): Record<FingerName, FingerState> => ({
    thumb: {
        point: null,
        lastTrigger: 0
    },
    index: {
        point: null,
        lastTrigger: 0
    },
    middle: {
        point: null,
        lastTrigger: 0
    },
    ring: {
        point: null,
        lastTrigger: 0
    },
    pinky: {
        point: null,
        lastTrigger: 0
    }
});

const distance = (
    a: {
        x: number;
        y: number;
    },
    b: {
        x: number;
        y: number;
    }
) => Math.hypot(a.x - b.x, a.y - b.y);

const isFingerExtended = (hand: HandLandmarkerResult['landmarks'][number], finger: FingerName): boolean => {
    if (finger === 'thumb') {
        const tip = hand[4];
        const ip = hand[3];
        const mcp = hand[2];

        if (!tip || !ip || !mcp) {
            return false;
        }

        return distance(tip, mcp) > distance(ip, mcp) * 1.15;
    }

    const indexes = {
        index: {
            tip: 8,
            pip: 6,
            mcp: 5
        },
        middle: {
            tip: 12,
            pip: 10,
            mcp: 9
        },
        ring: {
            tip: 16,
            pip: 14,
            mcp: 13
        },
        pinky: {
            tip: 20,
            pip: 18,
            mcp: 17
        }
    };

    const { tip: tipIndex, pip: pipIndex, mcp: mcpIndex } = indexes[finger];

    const tip = hand[tipIndex];
    const pip = hand[pipIndex];
    const mcp = hand[mcpIndex];

    if (!tip || !pip || !mcp) {
        return false;
    }

    return distance(tip, mcp) > distance(pip, mcp) * 1.2;
};

const drawConnection = (ctx: CanvasRenderingContext2D, from: Point, to: Point) => {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);

    ctx.strokeStyle = 'rgba(255,255,255,0.45)';

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
};

export default function TargetTracker({
    width,
    height,
    enabled = true,
    fingerConfigs = DEFAULT_FINGER_CONFIGS
}: Props) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const landmarkerRef = useRef<HandLandmarker | null>(null);

    const animationRef = useRef<number | null>(null);

    const lastVideoTimeRef = useRef(-1);

    const fingerStateRef = useRef<Record<FingerName, FingerState>>(createFingerState());

    const configRef = useRef<FingerConfigs>(fingerConfigs);

    const detectRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        configRef.current = fingerConfigs;
    }, [fingerConfigs]);

    useEffect(() => {
        const canvas = canvasRef.current;

        if (!canvas) return;

        canvas.width = width;
        canvas.height = height;
    }, [width, height]);

    useEffect(() => {
        detectRef.current = () => {
            const canvas = canvasRef.current;

            const ctx = canvas?.getContext('2d');

            const video = document.querySelector('.camera-video') as HTMLVideoElement | null;

            const landmarker = landmarkerRef.current;

            if (!canvas || !ctx || !video || !landmarker) {
                animationRef.current = requestAnimationFrame(() => detectRef.current?.());

                return;
            }

            if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
                animationRef.current = requestAnimationFrame(() => detectRef.current?.());

                return;
            }

            if (video.currentTime === lastVideoTimeRef.current) {
                animationRef.current = requestAnimationFrame(() => detectRef.current?.());

                return;
            }

            lastVideoTimeRef.current = video.currentTime;

            let result: HandLandmarkerResult;

            try {
                result = landmarker.detectForVideo(video, performance.now());
            } catch (error) {
                console.error('Hand detection error:', error);

                animationRef.current = requestAnimationFrame(() => detectRef.current?.());

                return;
            }

            ctx.clearRect(0, 0, width, height);

            if (result.landmarks.length === 0) {
                fingerStateRef.current = createFingerState();

                animationRef.current = requestAnimationFrame(() => detectRef.current?.());

                return;
            }

            const hand = result.landmarks[0];

            const configs = configRef.current;

            for (const finger of FINGERS) {
                const state = fingerStateRef.current[finger.name];

                const config: FingerConfig = configs[finger.name];

                const extended = isFingerExtended(hand, finger.name);

                if (!extended || !config.enabled) {
                    state.point = null;
                    continue;
                }

                const landmark = hand[finger.index];

                if (!landmark) {
                    state.point = null;
                    continue;
                }

                const normalizedX = 1 - landmark.x;

                const normalizedY = landmark.y;

                const point: Point = {
                    x: normalizedX * width,
                    y: normalizedY * height
                };

                const previous = state.point;

                if (previous) {
                    drawConnection(ctx, previous, point);
                }

                ctx.beginPath();

                ctx.arc(point.x, point.y, 9, 0, Math.PI * 2);

                ctx.fillStyle = 'rgba(255,255,255,0.95)';

                ctx.fill();

                ctx.beginPath();

                ctx.arc(point.x, point.y, 17, 0, Math.PI * 2);

                ctx.strokeStyle = 'rgba(255,255,255,0.3)';

                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.font = '12px Arial';

                ctx.fillStyle = 'rgba(255,255,255,0.9)';

                ctx.fillText(`${finger.name} ${config.note}${config.octave}`, point.x + 13, point.y - 12);

                if (!previous) {
                    state.point = point;
                    continue;
                }

                const movement = distance(point, previous);

                state.point = point;

                if (movement < Math.max(width, height) * MOVEMENT_THRESHOLD) {
                    continue;
                }

                const now = performance.now();

                if (now - state.lastTrigger < NOTE_COOLDOWN) {
                    continue;
                }

                const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

                const scaleIndex = Math.min(scale.length - 1, Math.floor((1 - normalizedY) * scale.length));

                const baseFrequency = frequencyFromConfig(config);

                const frequency = baseFrequency * Math.pow(2, scale[scaleIndex] / 12);
                const normalizedMovement = movement / Math.max(width, height);

                const velocity = Math.min(0.8, 0.3 + normalizedMovement * 8);

                const pan = normalizedX * 2 - 1;

                audioEngine.init();

                audioEngine.playNote(frequency, velocity * config.volume, pan);

                state.lastTrigger = now;
            }

            animationRef.current = requestAnimationFrame(() => detectRef.current?.());
        };
    }, [width, height]);

    useEffect(() => {
        if (!enabled) return;

        let cancelled = false;

        const initialize = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks('/mediapipe');

                if (cancelled) return;

                const landmarker = await HandLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath:
                            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
                        delegate: 'GPU'
                    },
                    runningMode: 'VIDEO',
                    numHands: 1,
                    minHandDetectionConfidence: 0.55,
                    minHandPresenceConfidence: 0.55,
                    minTrackingConfidence: 0.55
                });

                if (cancelled) {
                    landmarker.close();
                    return;
                }

                landmarkerRef.current = landmarker;

                fingerStateRef.current = createFingerState();

                animationRef.current = requestAnimationFrame(() => detectRef.current?.());
            } catch (error) {
                console.error('Failed to initialize hand tracker:', error);
            }
        };

        initialize();

        return () => {
            cancelled = true;

            if (animationRef.current !== null) {
                cancelAnimationFrame(animationRef.current);
            }

            landmarkerRef.current?.close();

            landmarkerRef.current = null;

            fingerStateRef.current = createFingerState();

            lastVideoTimeRef.current = -1;
        };
    }, [enabled]);

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
                zIndex: 3
            }}
        />
    );
}
