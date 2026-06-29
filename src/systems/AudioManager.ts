import { saveState } from "@/systems/SaveState";

/** Named sound effects synthesized on the fly. */
export type SfxName =
  | "jump"
  | "coin"
  | "stomp"
  | "powerup"
  | "hurt"
  | "death"
  | "complete"
  | "brick"
  | "extralife";

type Wave = OscillatorType;

/**
 * Procedural chiptune audio — every sound is synthesized with the Web Audio API,
 * so there are zero audio asset files (and nothing to license). Provides retro
 * SFX, a looping background tune, and a persisted mute toggle.
 *
 * Browsers block audio until a user gesture, so call `unlock()` from the first
 * key/pointer event; everything is a no-op until then and never throws.
 */
class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicStep = 0;
  private initialized = false;

  /** Create the audio graph and resume it (safe to call repeatedly). */
  unlock(): void {
    if (!this.initialized) {
      try {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.muted = saveState.isMuted();
        this.master.gain.value = this.muted ? 0 : 0.6;
        this.master.connect(this.ctx.destination);
        this.initialized = true;
      } catch {
        return; // audio unavailable — game continues silently
      }
    }
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** Toggle mute, persist it, and return the new state. */
  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.6;
    saveState.setMuted(this.muted);
    return this.muted;
  }

  // ----- SFX -----

  /** Schedule a single enveloped oscillator note. */
  private tone(
    freq: number,
    freqEnd: number,
    dur: number,
    type: Wave,
    gain: number,
    when: number
  ): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (freqEnd > 0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), when + dur);
    }
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(gain, when + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(env);
    env.connect(this.master);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  /** Play a short sequence of notes starting now. */
  private seq(
    notes: Array<[freq: number, dur: number]>,
    type: Wave,
    gain: number
  ): void {
    if (!this.ctx) return;
    let t = this.ctx.currentTime + 0.01;
    for (const [freq, dur] of notes) {
      this.tone(freq, 0, dur, type, gain, t);
      t += dur;
    }
  }

  play(name: SfxName): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    switch (name) {
      case "jump":
        this.tone(330, 760, 0.16, "square", 0.2, t);
        break;
      case "coin":
        this.seq([[988, 0.07], [1319, 0.12]], "square", 0.2);
        break;
      case "stomp":
        this.tone(220, 70, 0.18, "square", 0.22, t);
        break;
      case "brick":
        this.tone(180, 50, 0.12, "square", 0.2, t);
        this.tone(90, 40, 0.12, "triangle", 0.2, t + 0.01);
        break;
      case "powerup":
        this.seq(
          [[523, 0.08], [659, 0.08], [784, 0.08], [1047, 0.14]],
          "square",
          0.18
        );
        break;
      case "extralife":
        this.seq([[784, 0.09], [1047, 0.09], [1319, 0.16]], "triangle", 0.2);
        break;
      case "hurt":
        this.tone(320, 120, 0.26, "sawtooth", 0.2, t);
        break;
      case "death":
        this.tone(440, 110, 0.5, "square", 0.22, t);
        this.tone(330, 70, 0.5, "square", 0.18, t + 0.12);
        break;
      case "complete":
        this.seq(
          [[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.12], [1319, 0.26]],
          "square",
          0.2
        );
        break;
    }
  }

  // ----- Background music -----

  /** A short, loopable melody + bass line (frequencies in Hz; 0 = rest). */
  private static readonly MELODY = [
    523, 0, 659, 523, 784, 0, 659, 0, 587, 0, 440, 523, 392, 0, 659, 0,
  ];
  private static readonly BASS = [131, 196, 165, 196];

  startMusic(): void {
    if (!this.ctx || this.musicTimer !== null) return;
    const stepMs = 200;
    this.musicStep = 0;
    this.musicTimer = setInterval(() => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.02;
      const m = AudioManager.MELODY[this.musicStep % AudioManager.MELODY.length];
      if (m > 0) this.tone(m, 0, 0.18, "square", 0.05, t);
      if (this.musicStep % 4 === 0) {
        const b = AudioManager.BASS[(this.musicStep / 4) % AudioManager.BASS.length];
        this.tone(b, 0, 0.36, "triangle", 0.06, t);
      }
      this.musicStep++;
    }, stepMs);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

export const audioManager = new AudioManager();
