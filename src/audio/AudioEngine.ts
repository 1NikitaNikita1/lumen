/**
 * A tiny synth built on the Web Audio API. No samples, no dependencies:
 * every note is generated on the fly from oscillators so it can respond
 * the instant the scanner crosses a line.
 *
 * Browsers block audio until a user gesture has occurred, so `init()`
 * must be called from within a click/touch/pointer handler before any
 * note will actually be audible.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  // A soft feedback delay that every note bleeds into, so consecutive notes
  // wash into one another instead of sounding like separate, cleanly cut hits.
  private delayNode: DelayNode | null = null;
  private feedbackGain: GainNode | null = null;
  private delayWet: GainNode | null = null;
  private volume = 0.7;

  /** Must be called from inside a user gesture handler. Safe to call repeatedly. */
  init(): void {
    if (!this.context) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      this.context = ctx;

      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(ctx.destination);

      this.delayNode = ctx.createDelay(1.0);
      this.delayNode.delayTime.value = 0.24;
      this.feedbackGain = ctx.createGain();
      this.feedbackGain.gain.value = 0.36;
      this.delayWet = ctx.createGain();
      this.delayWet.gain.value = 0.4;

      // Feedback loop: delay -> feedback -> delay, so repeats decay away.
      this.delayNode.connect(this.feedbackGain);
      this.feedbackGain.connect(this.delayNode);
      // Tap the loop out to the master bus.
      this.delayNode.connect(this.delayWet);
      this.delayWet.connect(this.masterGain);
    }
    if (this.context.state === "suspended") {
      void this.context.resume();
    }
  }

  get isReady(): boolean {
    return !!this.context && this.context.state === "running";
  }

  setVolume(v: number): void {
    this.volume = Math.min(Math.max(v, 0), 1);
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume;
    }
  }

  getVolume(): number {
    return this.volume;
  }

  /**
   * Plays a single, self-contained note voiced like a softened mallet
   * instrument (a "blurred" xylophone): rounded onset, no hard attack
   * transient, and a long tail that bleeds into the shared delay bus so
   * consecutive notes overlap rather than feeling cut off from each other.
   */
  playNote(frequency: number): void {
    const ctx = this.context;
    const master = this.masterGain;
    const delayBus = this.delayNode;
    if (!ctx || !master) return;

    const now = ctx.currentTime;

    // Two sine-family oscillators, one very slightly detuned, replace a
    // bright harmonic shimmer with a soft, faintly chorused body — the
    // detuning is what gives it that smeared, not-quite-in-focus quality.
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, now);

    const body = ctx.createOscillator();
    body.type = "triangle";
    body.frequency.setValueAtTime(frequency, now);
    body.detune.setValueAtTime(-7, now);

    const bodyGain = ctx.createGain();
    bodyGain.gain.value = 0.4;

    // A gentle lowpass keeps the top end soft instead of glassy/metallic.
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(Math.min(frequency * 3.2, 3200), now);
    filter.Q.value = 0.3;

    const envelope = ctx.createGain();
    const peak = 0.5;
    const attack = 0.045; // rounded onset — no percussive click
    const release = 1.3; // long, smooth fade so notes overlap and blur together

    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(peak, now + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + attack + release);

    const dry = ctx.createGain();
    dry.gain.value = 0.85;
    const send = ctx.createGain();
    send.gain.value = 0.5;

    osc.connect(filter);
    body.connect(bodyGain);
    bodyGain.connect(filter);
    filter.connect(envelope);
    envelope.connect(dry);
    dry.connect(master);
    if (delayBus) {
      envelope.connect(send);
      send.connect(delayBus);
    }

    const stopAt = now + attack + release + 0.05;
    osc.start(now);
    body.start(now);
    osc.stop(stopAt);
    body.stop(stopAt);

    // Release references promptly once the note has finished playing.
    osc.onended = () => {
      osc.disconnect();
      body.disconnect();
      bodyGain.disconnect();
      filter.disconnect();
      envelope.disconnect();
      dry.disconnect();
      send.disconnect();
    };
  }
}

export const audioEngine = new AudioEngine();
