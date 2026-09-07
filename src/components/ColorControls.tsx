import { useState } from 'react';

import { type FingerConfig, frequencyFromConfig } from './FingerControls';
import { COLOR_NOTES } from '../audio/noteMapping';

export type ColorConfig = FingerConfig;
export type ColorConfigs = Record<string, ColorConfig>;

export { frequencyFromConfig };

const buildDefaults = (): ColorConfigs => {
    const configs: ColorConfigs = {};

    for (const { color, note } of COLOR_NOTES) {
        configs[color] = {
            enabled: true,
            note,
            octave: 4,
            volume: 0.6
        };
    }

    return configs;
};

export const DEFAULT_COLOR_CONFIGS = buildDefaults();

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

type Props = {
    value?: ColorConfigs;
    onChange?: (value: ColorConfigs) => void;
};

export default function ColorControls({ value, onChange }: Props) {
    const [internalValue, setInternalValue] = useState<ColorConfigs>(DEFAULT_COLOR_CONFIGS);
    const [open, setOpen] = useState(false);

    const configs = value ?? internalValue;
    const enabledCount = Object.values(configs).filter((config) => config.enabled).length;

    const update = (color: string, patch: Partial<ColorConfig>) => {
        const next: ColorConfigs = {
            ...configs,
            [color]: {
                ...configs[color],
                ...patch
            }
        };

        if (!value) setInternalValue(next);
        onChange?.(next);
    };

    return (
        <div className={`color-controls ${open ? 'color-controls--open' : ''}`}>
            <button
                type='button'
                className='color-controls__trigger'
                onClick={() => setOpen((current) => !current)}
                aria-expanded={open}
            >
                <div className='color-controls__trigger-left'>
                    <span className='color-controls__icon'>🎨</span>
                    <div>
                        <div className='color-controls__title'>Colors</div>
                        {!open && <div className='color-controls__summary'>{enabledCount} active</div>}
                    </div>
                </div>
                <span className={`color-controls__arrow ${open ? 'is-open' : ''}`}>↓</span>
            </button>

            <div className='color-controls__content'>
                <div className='color-controls__list'>
                    {COLOR_NOTES.map(({ color, label }) => {
                        const config = configs[color];
                        if (!config) return null;

                        return (
                            <div
                                key={color}
                                className={`color-control ${config.enabled ? 'color-control--active' : ''}`}
                            >
                                <button
                                    type='button'
                                    className='color-control__toggle'
                                    onClick={() => update(color, { enabled: !config.enabled })}
                                >
                                    <span className='color-control__swatch' style={{ background: color }} />
                                    <span className='color-control__label'>{label}</span>
                                </button>

                                <div className='color-control__pitch'>
                                    <select
                                        value={config.note}
                                        disabled={!config.enabled}
                                        onChange={(e) => update(color, { note: e.target.value })}
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
                                        onChange={(e) => update(color, { octave: Number(e.target.value) })}
                                    >
                                        {[2, 3, 4, 5, 6].map((octave) => (
                                            <option key={octave} value={octave}>
                                                Oct {octave}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className='color-control__volume-row'>
                                    <input
                                        type='range'
                                        min='0'
                                        max='1'
                                        step='0.01'
                                        value={config.volume}
                                        disabled={!config.enabled}
                                        onChange={(e) => update(color, { volume: Number(e.target.value) })}
                                    />
                                    <span className='color-control__volume'>
                                        {Math.round(config.volume * 100)}%
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <style>{`
                .color-controls {
                    position: absolute;
                    z-index: 100;
                    top: 16px;
                    left: 16px;
                    width: min(400px, calc(100vw - 32px));
                    box-sizing: border-box;
                    color: #fff;
                    font-family: Arial, sans-serif;
                    user-select: none;
                }
                .color-controls__trigger {
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
                .color-controls__trigger-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
                .color-controls__icon {
                    width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
                    flex-shrink: 0; border-radius: 9px; background: rgba(255, 255, 255, 0.1); font-size: 15px;
                }
                .color-controls__title { font-size: 14px; font-weight: 600; line-height: 18px; }
                .color-controls__summary { margin-top: 1px; color: rgba(255, 255, 255, 0.5); font-size: 11px; }
                .color-controls__arrow {
                    display: flex; align-items: center; justify-content: center; width: 26px; height: 26px;
                    flex-shrink: 0; border-radius: 8px; background: rgba(255, 255, 255, 0.08);
                    color: rgba(255, 255, 255, 0.7); font-size: 14px;
                    transition: transform 0.2s ease, background 0.2s ease;
                }
                .color-controls__arrow.is-open { transform: rotate(180deg); background: rgba(255, 255, 255, 0.14); }
                .color-controls__content { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.25s ease; }
                .color-controls--open .color-controls__content { grid-template-rows: 1fr; }
                .color-controls__list {
                    min-height: 0; overflow: hidden; margin-top: 0; padding: 0;
                    display: flex; flex-direction: column; gap: 7px;
                    opacity: 0; transform: translateY(-6px);
                    transition: opacity 0.2s ease, transform 0.25s ease, margin-top 0.25s ease, padding 0.25s ease;
                }
                .color-controls--open .color-controls__list {
                    margin-top: 8px; padding: 8px; opacity: 1; transform: translateY(0);
                    border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 14px;
                    background: rgba(15, 15, 18, 0.78); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
                }
                .color-control {
                    display: grid; grid-template-columns: 96px minmax(120px, 1fr); grid-template-rows: auto auto;
                    gap: 7px 8px; padding: 9px; border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 11px;
                    background: rgba(255, 255, 255, 0.035);
                    transition: opacity 0.2s ease, background 0.2s ease, border-color 0.2s ease;
                }
                .color-control:not(.color-control--active) { opacity: 0.45; }
                .color-control--active { background: rgba(255, 255, 255, 0.055); border-color: rgba(255, 255, 255, 0.11); }
                .color-control__toggle {
                    grid-row: 1 / 3; min-width: 0; display: flex; align-items: center; gap: 7px;
                    padding: 0; border: 0; background: none; color: #fff; cursor: pointer; text-align: left;
                }
                .color-control__swatch { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 6px currentColor; }
                .color-control__label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 500; }
                .color-control__pitch { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
                .color-control select {
                    width: 100%; min-width: 0; height: 30px; padding: 0 7px;
                    border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 7px; outline: none;
                    background: rgba(0, 0, 0, 0.25); color: #fff; font-size: 11px; cursor: pointer;
                }
                .color-control select:disabled { cursor: default; opacity: 0.45; }
                .color-control option { background: #18181b; color: #fff; }
                .color-control__volume-row { display: flex; align-items: center; gap: 7px; }
                .color-control input[type='range'] { width: 100%; min-width: 0; height: 18px; margin: 0; accent-color: #fff; cursor: pointer; }
                .color-control input[type='range']:disabled { cursor: default; opacity: 0.4; }
                .color-control__volume { width: 32px; flex-shrink: 0; color: rgba(255, 255, 255, 0.55); font-size: 10px; text-align: right; }

                @media (max-width: 600px) {
                    .color-controls { top: 10px; left: 10px; width: min(320px, calc(100vw - 20px)); }
                    .color-control { grid-template-columns: 75px minmax(100px, 1fr); padding: 7px; gap: 6px; }
                }
            `}</style>
        </div>
    );
}
