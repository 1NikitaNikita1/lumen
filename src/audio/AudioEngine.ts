export class AudioEngine {
    private context: AudioContext | null = null;

    private masterGain: GainNode | null = null;
    private compressor: DynamicsCompressorNode | null = null;

    private delayNode: DelayNode | null = null;
    private feedbackGain: GainNode | null = null;
    private delayWet: GainNode | null = null;

    private volume = 0.7;

    private voices = new Set<{
        osc: OscillatorNode;
        body: OscillatorNode;
        gain: GainNode;
        panner: StereoPannerNode;
    }>();

    private lastFrequency: number | null = null;

    /**
     * Initializes and unlocks Web Audio.
     *
     * IMPORTANT:
     * Call this from a real user interaction:
     * onClick / onPointerDown / onTouchStart.
     */
    init(): void {
        if (!this.context) {
            const AudioContextClass =
                window.AudioContext ||
                (
                    window as typeof window & {
                        webkitAudioContext?: typeof AudioContext;
                    }
                ).webkitAudioContext;

            if (!AudioContextClass) {
                console.warn('Web Audio API is not supported');
                return;
            }

            const ctx = new AudioContextClass();

            this.context = ctx;

            // -------------------------
            // MASTER
            // -------------------------

            this.masterGain = ctx.createGain();
            this.masterGain.gain.value = this.volume;

            // -------------------------
            // COMPRESSOR
            // -------------------------

            this.compressor = ctx.createDynamicsCompressor();

            this.compressor.threshold.value = -18;
            this.compressor.knee.value = 12;
            this.compressor.ratio.value = 3;
            this.compressor.attack.value = 0.01;
            this.compressor.release.value = 0.25;

            this.masterGain.connect(this.compressor);

            this.compressor.connect(ctx.destination);

            // -------------------------
            // DELAY / ECHO
            // -------------------------

            this.delayNode = ctx.createDelay(2);

            this.delayNode.delayTime.value = 0.32;

            this.feedbackGain = ctx.createGain();

            this.feedbackGain.gain.value = 0.28;

            this.delayWet = ctx.createGain();

            this.delayWet.gain.value = 0.22;

            this.delayNode.connect(this.feedbackGain);

            this.feedbackGain.connect(this.delayNode);

            this.delayNode.connect(this.delayWet);

            this.delayWet.connect(this.masterGain);
        }

        // ------------------------------------------------
        // IMPORTANT FOR MOBILE
        // ------------------------------------------------

        if (this.context.state !== 'running') {
            void this.context.resume();
        }
    }

    /**
     * Whether audio is currently available.
     */
    get isReady(): boolean {
        return this.context !== null && this.context.state === 'running';
    }

    /**
     * Returns current AudioContext state.
     */
    get state(): AudioContextState | null {
        return this.context?.state ?? null;
    }

    /**
     * Changes master volume.
     */
    setVolume(value: number): void {
        this.volume = Math.min(Math.max(value, 0), 1);

        if (!this.masterGain || !this.context) {
            return;
        }

        const now = this.context.currentTime;

        this.masterGain.gain.cancelScheduledValues(now);

        this.masterGain.gain.setTargetAtTime(this.volume, now, 0.03);
    }

    /**
     * Returns master volume.
     */
    getVolume(): number {
        return this.volume;
    }

    /**
     * Plays a musical note.
     *
     * frequency - frequency in Hz
     * velocity  - 0..1
     * pan       - -1..1
     */
    playNote(frequency: number, velocity = 0.6, pan = 0): void {
        const ctx = this.context;
        const master = this.masterGain;

        if (!ctx || !master) {
            return;
        }

        // Prevent NaN / Infinity from reaching Web Audio.
        if (!Number.isFinite(frequency) || frequency <= 0) {
            console.warn('AudioEngine: invalid frequency', frequency);
            return;
        }

        if (!Number.isFinite(velocity)) {
            velocity = 0.6;
        }

        if (!Number.isFinite(pan)) {
            pan = 0;
        }

        if (ctx.state === 'suspended') {
            void ctx.resume();
        }

        const now = ctx.currentTime;

        velocity = Math.min(Math.max(velocity, 0), 1);

        pan = Math.min(Math.max(pan, -1), 1);

        // ------------------------------------------------
        // OSCILLATORS
        // ------------------------------------------------

        const osc = ctx.createOscillator();

        const body = ctx.createOscillator();

        osc.type = 'sine';
        body.type = 'triangle';

        body.detune.value = -6;

        const startFrequency =
            this.lastFrequency && Number.isFinite(this.lastFrequency) ? this.lastFrequency : frequency;

        osc.frequency.setValueAtTime(startFrequency, now);

        body.frequency.setValueAtTime(startFrequency, now);

        osc.frequency.exponentialRampToValueAtTime(frequency, now + 0.08);

        body.frequency.exponentialRampToValueAtTime(frequency, now + 0.08);

        this.lastFrequency = frequency;

        // ------------------------------------------------
        // FILTER
        // ------------------------------------------------

        const filter = ctx.createBiquadFilter();

        filter.type = 'lowpass';

        const filterFrequency = 1300 + velocity * 2800;

        filter.frequency.setValueAtTime(filterFrequency, now);

        filter.Q.value = 0.7;

        // ------------------------------------------------
        // ENVELOPE
        // ------------------------------------------------

        const gain = ctx.createGain();

        const peak = 0.14 + velocity * 0.3;

        const attack = 0.06;
        const release = 1.6;

        gain.gain.setValueAtTime(0.0001, now);

        gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), now + attack);

        gain.gain.setValueAtTime(Math.max(peak * 0.82, 0.0001), now + 0.3);

        gain.gain.exponentialRampToValueAtTime(0.0001, now + release);

        // ------------------------------------------------
        // PAN
        // ------------------------------------------------

        const panner = ctx.createStereoPanner();

        panner.pan.setValueAtTime(pan, now);

        // ------------------------------------------------
        // CONNECTIONS
        // ------------------------------------------------

        osc.connect(filter);
        body.connect(filter);

        filter.connect(gain);
        gain.connect(panner);
        panner.connect(master);

        // ------------------------------------------------
        // DELAY
        // ------------------------------------------------

        if (this.delayNode) {
            const send = ctx.createGain();

            send.gain.value = 0.18;

            gain.connect(send);
            send.connect(this.delayNode);

            window.setTimeout(
                () => {
                    try {
                        send.disconnect();
                    } catch {
                        // Already disconnected.
                    }
                },
                (release + 0.5) * 1000
            );
        }

        // ------------------------------------------------
        // START / STOP
        // ------------------------------------------------

        osc.start(now);
        body.start(now);

        const stopAt = now + release + 0.15;

        osc.stop(stopAt);
        body.stop(stopAt);

        const voice = {
            osc,
            body,
            gain,
            panner
        };

        this.voices.add(voice);

        osc.onended = () => {
            try {
                osc.disconnect();
                body.disconnect();
                filter.disconnect();
                gain.disconnect();
                panner.disconnect();
            } catch {
                // Already disconnected.
            }

            this.voices.delete(voice);
        };
    }

    /**
     * Immediately fades out all currently playing notes.
     */
    stopAll(): void {
        const ctx = this.context;

        if (!ctx) {
            return;
        }

        const now = ctx.currentTime;

        for (const voice of this.voices) {
            voice.gain.gain.cancelScheduledValues(now);

            voice.gain.gain.setTargetAtTime(0.0001, now, 0.08);
        }

        this.lastFrequency = null;
    }

    /**
     * Completely closes the AudioContext.
     */
    destroy(): void {
        this.stopAll();

        if (this.context) {
            void this.context.close();
        }

        this.context = null;

        this.masterGain = null;

        this.compressor = null;

        this.delayNode = null;

        this.feedbackGain = null;

        this.delayWet = null;

        this.voices.clear();

        this.lastFrequency = null;
    }
}

export const audioEngine = new AudioEngine();
