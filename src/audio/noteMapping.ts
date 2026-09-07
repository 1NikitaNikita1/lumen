export type ColorNote = {
  /** Hex color used both for the stroke and the palette swatch. */
  color: string;
  /** Human label shown in the palette UI. */
  label: string;
  /** Note name at the reference octave (4). */
  note: string;
  /** Frequency in Hz at octave 4. */
  baseFreq: number;
};

// A deliberately warmer, less saturated take on a rainbow — matched to a
// six-note major hexatonic run (C D E F G A) so any combination of strokes
// sounds consonant rather than random.
export const COLOR_NOTES: ColorNote[] = [
  { color: "#E85D4E", label: "Red", note: "C", baseFreq: 261.63 },
  { color: "#EE9A3A", label: "Orange", note: "D", baseFreq: 293.66 },
  { color: "#F2CB4E", label: "Yellow", note: "E", baseFreq: 329.63 },
  { color: "#4FAE7A", label: "Green", note: "F", baseFreq: 349.23 },
  { color: "#3E8FD0", label: "Blue", note: "G", baseFreq: 392.0 },
  { color: "#9169C4", label: "Purple", note: "A", baseFreq: 440.0 },
];

const DEFAULT_NOTE = COLOR_NOTES[0];

const REFERENCE_OCTAVE = 4;
const MIN_OCTAVE = 2;
const MAX_OCTAVE = 6;

function findColorNote(color: string): ColorNote {
  return COLOR_NOTES.find((c) => c.color.toLowerCase() === color.toLowerCase()) ?? DEFAULT_NOTE;
}

/**
 * Converts a color and a normalized vertical position (0 = bottom/low,
 * 1 = top/high) into a frequency. Shared by the canvas scanner (which
 * derives the fraction from pixel Y) and the Telegram combo rules (which
 * let the user pick the fraction directly with a slider).
 */
export function frequencyForColorAtHeight(color: string, heightFraction: number): number {
  const { baseFreq } = findColorNote(color);
  const clamped = Math.min(Math.max(heightFraction, 0), 1);
  const octave = MIN_OCTAVE + clamped * (MAX_OCTAVE - MIN_OCTAVE);
  const octaveShift = octave - REFERENCE_OCTAVE;
  return baseFreq * Math.pow(2, octaveShift);
}

/**
 * Converts a stroke color and the vertical pixel position where the scanner
 * crossed it into a playable frequency. Higher on screen (smaller y) means
 * a higher octave.
 */
export function frequencyForCrossing(color: string, y: number, canvasHeight: number): number {
  const height = canvasHeight || 1;
  const clampedY = Math.min(Math.max(y, 0), height);
  const fractionFromTop = 1 - clampedY / height;
  return frequencyForColorAtHeight(color, fractionFromTop);
}

export function noteLabelForColor(color: string): string {
  const entry = findColorNote(color);
  return `${entry.note} · ${entry.label}`;
}

// ---------------------------------------------------------------------------
// Text → melody mapping, used by the Telegram tab.
// ---------------------------------------------------------------------------

/** A pleasant major scale spanning four octaves, so any character maps onto a note that fits. */
const SCALE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
const SCALE_BASE_FREQ = 130.81; // C3
const SCALE_OCTAVE_SPAN = 4;

const SCALE_FREQUENCIES: number[] = (() => {
  const freqs: number[] = [];
  for (let octave = 0; octave < SCALE_OCTAVE_SPAN; octave++) {
    for (const semitone of SCALE_SEMITONES) {
      freqs.push(SCALE_BASE_FREQ * Math.pow(2, (octave * 12 + semitone) / 12));
    }
  }
  return freqs;
})();

export type NoteEvent = {
  frequency: number;
  /** For the live-note visualizer strip. */
  color: string;
};

/** Deterministic character → note: the same character always lands on the same pitch and swatch color. */
export function charToNoteEvent(char: string): NoteEvent {
  const code = char.codePointAt(0) ?? 0;
  const frequency = SCALE_FREQUENCIES[code % SCALE_FREQUENCIES.length];
  const color = COLOR_NOTES[code % COLOR_NOTES.length].color;
  return { frequency, color };
}

export type ComboRule = {
  id: string;
  /** Substring to match, case-insensitively, e.g. ":)" or "lol". */
  pattern: string;
  color: string;
  /** 0 = low octave, 1 = high octave. */
  height: number;
};

/**
 * Turns a message into an ordered sequence of notes: configured combo
 * patterns are matched first (longest pattern wins on a tie), and any
 * character not covered by a combo falls back to the per-character
 * mapping. Whitespace is skipped so pauses in the message don't need a
 * dedicated "silent note".
 */
export function messageToNoteEvents(text: string, combos: ComboRule[]): NoteEvent[] {
  const events: NoteEvent[] = [];
  const activeCombos = combos
    .filter((c) => c.pattern.length > 0)
    .sort((a, b) => b.pattern.length - a.pattern.length);

  let i = 0;
  while (i < text.length) {
    const remaining = text.slice(i).toLowerCase();
    const match = activeCombos.find((c) => remaining.startsWith(c.pattern.toLowerCase()));

    if (match) {
      events.push({
        frequency: frequencyForColorAtHeight(match.color, match.height),
        color: match.color,
      });
      i += match.pattern.length;
      continue;
    }

    const char = text[i];
    if (!/\s/.test(char)) {
      events.push(charToNoteEvent(char));
    }
    i += 1;
  }

  return events;
}
