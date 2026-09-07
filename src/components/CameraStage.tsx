import { useCallback, useEffect, useState } from 'react';
import CameraBackground from './CameraBackground';
import DrawingCanvas from './DrawingCanvas';
import Scanner from './Scanner';
import ColorPalette from './ColorPalette';
import Controls from './Controls';
import ColorControls, { DEFAULT_COLOR_CONFIGS, frequencyFromConfig, type ColorConfigs } from './ColorControls';
import type { DrawnLine } from '../drawing/Line';
import type { Crossing } from '../drawing/collisionDetection';
import { COLOR_NOTES } from '../audio/noteMapping';
import { audioEngine } from '../audio/AudioEngine';
import { useViewportSize } from '../hooks/useViewportSize';
import FingerControls, { DEFAULT_FINGER_CONFIGS, FingerConfigs } from './FingerControls';
import TargetTracker from './TargetTracker';
import MotionTracker from './MotionTracker';

const DEFAULT_SPEED = 160; // px / second
const DEFAULT_VOLUME = 0.7;
type StageMode = 'draw' | 'motion' | 'track';

// Same octave-shift scale DrawingCanvas uses, so a crossing at a given
// height sounds like the same pitch a finger/pointer would trigger there.
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

export default function CameraStage() {
    const { width, height } = useViewportSize();
    const [mode, setMode] = useState<StageMode>('track');

    const [lines, setLines] = useState<DrawnLine[]>([]);
    const [activeColor, setActiveColor] = useState(COLOR_NOTES[0].color);
    const [colorConfigs, setColorConfigs] = useState<ColorConfigs>(DEFAULT_COLOR_CONFIGS);
    const [isPlaying, setIsPlaying] = useState(true);
    const [speed, setSpeed] = useState(DEFAULT_SPEED);
    const [volume, setVolume] = useState(DEFAULT_VOLUME);
    const [video, setVideo] = useState<HTMLVideoElement | null>(null);
    const [fingerConfigs, setFingerConfigs] = useState<FingerConfigs>(DEFAULT_FINGER_CONFIGS);

    useEffect(() => {
        audioEngine.setVolume(volume);
    }, [volume]);

    const handleStrokeStart = useCallback(() => {
        audioEngine.init();
    }, []);

    const handleLineComplete = useCallback((line: DrawnLine) => {
        setLines((prev) => [...prev, line]);
    }, []);

    const handleClear = useCallback(() => {
        setLines([]);
    }, []);

    const handleTogglePlay = useCallback(() => {
        audioEngine.init();
        setIsPlaying((p) => !p);
    }, []);

    const handleCrossing = useCallback(
        (crossing: Crossing) => {
            const config = colorConfigs[crossing.color];
            if (!config || !config.enabled) return;

            const normalizedY = crossing.y / height;
            const scaleIndex = Math.min(SCALE.length - 1, Math.floor((1 - normalizedY) * SCALE.length));
            const baseFrequency = frequencyFromConfig(config);
            const frequency = baseFrequency * Math.pow(2, SCALE[scaleIndex] / 12);

            audioEngine.init();
            audioEngine.playNote(frequency, config.volume);
        },
        [colorConfigs, height]
    );

    return (
        <div className='stage'>
            <CameraBackground />

            {mode === 'draw' ? (
                <>
                    <DrawingCanvas
                        width={width}
                        height={height}
                        lines={lines}
                        activeColor={activeColor}
                        colorConfigs={colorConfigs}
                        onStrokeStart={handleStrokeStart}
                        onLineComplete={handleLineComplete}
                    />

                    <Scanner
                        width={width}
                        height={height}
                        lines={lines}
                        speed={speed}
                        isPlaying={isPlaying}
                        onCrossing={handleCrossing}
                    />

                    <ColorControls value={colorConfigs} onChange={setColorConfigs} />
                </>
            ) : mode === 'track' ? (
                <>
                    <FingerControls value={fingerConfigs} onChange={setFingerConfigs} />
                    <TargetTracker width={width} height={height} enabled={true} fingerConfigs={fingerConfigs} />
                </>
            ) : (
                <MotionTracker video={video} width={width} height={height} enabled={isPlaying} />
            )}

            <div className='stage__ui'>
                <div className='mode-switch'>
                    <button
                        type='button'
                        onClick={() => setMode('draw')}
                        className={mode === 'draw' ? 'active' : ''}
                    >
                        Draw
                    </button>
                    <button
                        type='button'
                        onClick={() => setMode('motion')}
                        className={mode === 'motion' ? 'active' : ''}
                    >
                        Motion
                    </button>
                    <button
                        type='button'
                        onClick={() => setMode('track')}
                        className={mode === 'track' ? 'active' : ''}
                    >
                        Track
                    </button>
                </div>

                {mode === 'draw' && <ColorPalette activeColor={activeColor} onSelect={setActiveColor} />}

                <Controls
                    isPlaying={isPlaying}
                    onTogglePlay={handleTogglePlay}
                    onClear={handleClear}
                    speed={speed}
                    onSpeedChange={setSpeed}
                    volume={volume}
                    onVolumeChange={setVolume}
                />
            </div>
        </div>
    );
}
