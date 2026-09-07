import { useState } from 'react';

export type FingerName = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';

export type FingerConfig = {
    enabled: boolean;
    note: string;
    octave: number;
    volume: number;
};

export type FingerConfigs = Record<FingerName, FingerConfig>;

type Props = {
    value?: FingerConfigs;
    onChange?: (value: FingerConfigs) => void;
};

const FINGERS: {
    name: FingerName;
    label: string;
}[] = [
    { name: 'thumb', label: 'Thumb' },
    { name: 'index', label: 'Index' },
    { name: 'middle', label: 'Middle' },
    { name: 'ring', label: 'Ring' },
    { name: 'pinky', label: 'Pinky' }
];

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const DEFAULT_CONFIGS: FingerConfigs = {
    thumb: {
        enabled: true,
        note: 'C',
        octave: 3,
        volume: 0.55
    },
    index: {
        enabled: true,
        note: 'E',
        octave: 4,
        volume: 0.65
    },
    middle: {
        enabled: true,
        note: 'G',
        octave: 4,
        volume: 0.65
    },
    ring: {
        enabled: true,
        note: 'B',
        octave: 4,
        volume: 0.55
    },
    pinky: {
        enabled: true,
        note: 'C',
        octave: 5,
        volume: 0.55
    }
};

const NOTE_FREQUENCIES: Record<string, number> = {
    C: 261.63,
    'C#': 277.18,
    D: 293.66,
    'D#': 311.13,
    E: 329.63,
    F: 349.23,
    'F#': 369.99,
    G: 392.0,
    'G#': 415.3,
    A: 440.0,
    'A#': 466.16,
    B: 493.88
};

export const frequencyFromConfig = (config: FingerConfig): number => {
    const base = NOTE_FREQUENCIES[config.note] ?? NOTE_FREQUENCIES.C;

    return base * Math.pow(2, config.octave - 4);
};

export const DEFAULT_FINGER_CONFIGS = DEFAULT_CONFIGS;

export default function FingerControls({ value, onChange }: Props) {
    const [internalValue, setInternalValue] = useState<FingerConfigs>(DEFAULT_CONFIGS);
    const [open, setOpen] = useState(false);

    const configs = value ?? internalValue;

    const enabledCount = Object.values(configs).filter((config) => config.enabled).length;

    const update = (finger: FingerName, patch: Partial<FingerConfig>) => {
        const next: FingerConfigs = {
            ...configs,
            [finger]: {
                ...configs[finger],
                ...patch
            }
        };

        if (!value) {
            setInternalValue(next);
        }

        onChange?.(next);
    };

    return (
        <div className={`finger-controls ${open ? 'finger-controls--open' : ''}`}>
            <button
                type='button'
                className='finger-controls__trigger'
                onClick={() => setOpen((current) => !current)}
                aria-expanded={open}
            >
                <div className='finger-controls__trigger-left'>
                    <span className='finger-controls__icon'>☝</span>

                    <div>
                        <div className='finger-controls__title'>Fingers</div>

                        {!open && <div className='finger-controls__summary'>{enabledCount} active</div>}
                    </div>
                </div>

                <span className={`finger-controls__arrow ${open ? 'is-open' : ''}`}>↓</span>
            </button>

            <div className='finger-controls__content'>
                <div className='finger-controls__list'>
                    {FINGERS.map((finger) => {
                        const config = configs[finger.name];

                        return (
                            <div
                                key={finger.name}
                                className={`finger-control ${config.enabled ? 'finger-control--active' : ''}`}
                            >
                                <button
                                    type='button'
                                    className='finger-control__toggle'
                                    onClick={() =>
                                        update(finger.name, {
                                            enabled: !config.enabled
                                        })
                                    }
                                >
                                    <span className='finger-control__indicator' />
                                    <span className='finger-control__finger-name'>{finger.label}</span>
                                </button>

                                <div className='finger-control__pitch'>
                                    <select
                                        value={config.note}
                                        disabled={!config.enabled}
                                        onChange={(event) =>
                                            update(finger.name, {
                                                note: event.target.value
                                            })
                                        }
                                    >
                                        {NOTES.map((note) => (
                                            <option key={note} value={note}>
                                                {note}
                                            </option>
                                        ))}
                                    </select>

                                    <select
                                        value={config.octave}
                                        disabled={!config.enabled}
                                        onChange={(event) =>
                                            update(finger.name, {
                                                octave: Number(event.target.value)
                                            })
                                        }
                                    >
                                        {[2, 3, 4, 5, 6].map((octave) => (
                                            <option key={octave} value={octave}>
                                                Oct {octave}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className='finger-control__volume-row'>
                                    <input
                                        type='range'
                                        min='0'
                                        max='1'
                                        step='0.01'
                                        value={config.volume}
                                        disabled={!config.enabled}
                                        onChange={(event) =>
                                            update(finger.name, {
                                                volume: Number(event.target.value)
                                            })
                                        }
                                    />

                                    <span className='finger-control__volume'>
                                        {Math.round(config.volume * 100)}%
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <style>{`
                .finger-controls {
                    position: absolute;
                    z-index: 100;
                    top: 16px;
                    right: 16px;
                    width: min(460px, calc(100vw - 32px));
                    box-sizing: border-box;
                    color: #fff;
                    font-family: Arial, sans-serif;
                    user-select: none;
                }

                .finger-controls__trigger {
                    width: 100%;
                    min-height: 52px;
                    padding: 10px 14px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;

                    border: 1px solid rgba(255, 255, 255, 0.16);
                    border-radius: 14px;
                    background: rgba(15, 15, 18, 0.82);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);

                    color: #fff;
                    cursor: pointer;
                    text-align: left;

                    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
                }

                .finger-controls__trigger:active {
                    transform: scale(0.99);
                }

                .finger-controls__trigger-left {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    min-width: 0;
                }

                .finger-controls__icon {
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;

                    border-radius: 9px;
                    background: rgba(255, 255, 255, 0.1);
                    font-size: 17px;
                }

                .finger-controls__title {
                    font-size: 14px;
                    font-weight: 600;
                    line-height: 18px;
                }

                .finger-controls__summary {
                    margin-top: 1px;
                    color: rgba(255, 255, 255, 0.5);
                    font-size: 11px;
                }

                .finger-controls__arrow {
                    display: flex;
                    align-items: center;
                    justify-content: center;

                    width: 26px;
                    height: 26px;
                    flex-shrink: 0;

                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.08);

                    color: rgba(255, 255, 255, 0.7);
                    font-size: 14px;

                    transition:
                        transform 0.2s ease,
                        background 0.2s ease;
                }

                .finger-controls__arrow.is-open {
                    transform: rotate(180deg);
                    background: rgba(255, 255, 255, 0.14);
                }

                .finger-controls__content {
                    display: grid;
                    grid-template-rows: 0fr;

                    transition: grid-template-rows 0.25s ease;
                }

                .finger-controls--open .finger-controls__content {
                    grid-template-rows: 1fr;
                }

                .finger-controls__list {
                    min-height: 0;
                    overflow: hidden;

                    margin-top: 0;
                    padding: 0;

                    display: flex;
                    flex-direction: column;
                    gap: 7px;

                    opacity: 0;
                    transform: translateY(-6px);

                    transition:
                        opacity 0.2s ease,
                        transform 0.25s ease,
                        margin-top 0.25s ease,
                        padding 0.25s ease;
                }

                .finger-controls--open .finger-controls__list {
                    margin-top: 8px;
                    padding: 8px;

                    opacity: 1;
                    transform: translateY(0);

                    border: 1px solid rgba(255, 255, 255, 0.12);
                    border-radius: 14px;
                    background: rgba(15, 15, 18, 0.78);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                }

                .finger-control {
                    display: grid;
                    grid-template-columns: 96px minmax(120px, 1fr);
                    grid-template-rows: auto auto;
                    gap: 7px 8px;

                    padding: 9px;

                    border: 1px solid rgba(255, 255, 255, 0.07);
                    border-radius: 11px;

                    background: rgba(255, 255, 255, 0.035);

                    transition:
                        opacity 0.2s ease,
                        background 0.2s ease,
                        border-color 0.2s ease;
                }

                .finger-control:not(.finger-control--active) {
                    opacity: 0.45;
                }

                .finger-control--active {
                    background: rgba(255, 255, 255, 0.055);
                    border-color: rgba(255, 255, 255, 0.11);
                }

                .finger-control__toggle {
                    grid-row: 1 / 3;

                    min-width: 0;
                    display: flex;
                    align-items: center;
                    gap: 7px;

                    padding: 0;

                    border: 0;
                    background: none;

                    color: #fff;
                    cursor: pointer;
                    text-align: left;
                }

                .finger-control__indicator {
                    width: 7px;
                    height: 7px;
                    flex-shrink: 0;

                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.25);

                    transition:
                        background 0.2s ease,
                        box-shadow 0.2s ease;
                }

                .finger-control--active .finger-control__indicator {
                    background: #fff;
                    box-shadow: 0 0 8px rgba(255, 255, 255, 0.7);
                }

                .finger-control__finger-name {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;

                    font-size: 12px;
                    font-weight: 500;
                }

                .finger-control__pitch {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 6px;
                }

                .finger-control select {
                    width: 100%;
                    min-width: 0;
                    height: 30px;
                    padding: 0 7px;

                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 7px;

                    outline: none;

                    background: rgba(0, 0, 0, 0.25);
                    color: #fff;

                    font-size: 11px;
                    cursor: pointer;
                }

                .finger-control select:disabled {
                    cursor: default;
                    opacity: 0.45;
                }

                .finger-control option {
                    background: #18181b;
                    color: #fff;
                }

                .finger-control__volume-row {
                    display: flex;
                    align-items: center;
                    gap: 7px;
                }

                .finger-control input[type='range'] {
                    width: 100%;
                    min-width: 0;
                    height: 18px;
                    margin: 0;
                    accent-color: #fff;
                    cursor: pointer;
                }

                .finger-control input[type='range']:disabled {
                    cursor: default;
                    opacity: 0.4;
                }

                .finger-control__volume {
                    width: 32px;
                    flex-shrink: 0;

                    color: rgba(255, 255, 255, 0.55);
                    font-size: 10px;
                    text-align: right;
                }

                @media (max-width: 600px) {
                    .finger-controls {
                        top: 10px;
                        right: 10px;
                        width: min(360px, calc(100vw - 20px));
                    }

                    .finger-controls__trigger {
                        min-height: 48px;
                        padding: 8px 11px;
                        border-radius: 12px;
                    }

                    .finger-controls__icon {
                        width: 28px;
                        height: 28px;
                    }

                    .finger-controls__title {
                        font-size: 13px;
                    }

                    .finger-controls--open .finger-controls__list {
                        padding: 6px;
                        border-radius: 12px;
                    }

                    .finger-control {
                        grid-template-columns: 75px minmax(100px, 1fr);
                        padding: 7px;
                        gap: 6px;
                    }

                    .finger-control__finger-name {
                        font-size: 11px;
                    }

                    .finger-control select {
                        height: 28px;
                        font-size: 10px;
                    }
                }

                @media (max-width: 360px) {
                    .finger-controls {
                        width: calc(100vw - 16px);
                        right: 8px;
                        top: 8px;
                    }

                    .finger-control {
                        grid-template-columns: 68px minmax(90px, 1fr);
                    }

                    .finger-control__pitch {
                        gap: 4px;
                    }

                    .finger-control select {
                        padding: 0 4px;
                    }
                }
            `}</style>
        </div>
    );
}
