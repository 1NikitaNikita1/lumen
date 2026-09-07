import { useCallback, useEffect, useState } from 'react';

import CameraBackground from './CameraBackground';
import DrawingCanvas from './DrawingCanvas';
import Scanner from './Scanner';
import MotionTracker from './MotionTracker';
import ColorPalette from './ColorPalette';
import Controls from './Controls';

import type { DrawnLine } from '../drawing/Line';
import type { Crossing } from '../drawing/collisionDetection';

import { COLOR_NOTES, frequencyForCrossing } from '../audio/noteMapping';

import { audioEngine } from '../audio/AudioEngine';
import { useViewportSize } from '../hooks/useViewportSize';
import TargetTracker from './TargetTracker';

const DEFAULT_SPEED = 160;
const DEFAULT_VOLUME = 0.7;

type StageMode = 'draw' | 'motion' | 'track';

export default function CameraStage() {
    const { width, height } = useViewportSize();
    const [video, setVideo] = useState<HTMLVideoElement | null>(null);

    const [mode, setMode] = useState<StageMode>('draw');

    const [lines, setLines] = useState<DrawnLine[]>([]);

    const [activeColor, setActiveColor] = useState(COLOR_NOTES[0].color);

    const [isPlaying, setIsPlaying] = useState(true);

    const [speed, setSpeed] = useState(DEFAULT_SPEED);

    const [volume, setVolume] = useState(DEFAULT_VOLUME);

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
            const frequency = frequencyForCrossing(crossing.color, crossing.y, height);

            audioEngine.playNote(frequency);
        },
        [height]
    );

    return (
        <div className='stage'>
            <CameraBackground onVideoReady={setVideo} />

            {mode === 'draw' ? (
                <>
                    <DrawingCanvas
                        width={width}
                        height={height}
                        lines={lines}
                        activeColor={activeColor}
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
                </>
            ) : mode === 'track' ? (
                <TargetTracker width={width} height={height} enabled={true} />
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
