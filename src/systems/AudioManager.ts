import { saveState } from "@/systems/SaveState";

/** Named sound effects synthesized on the fly. */
export type SfxName =
  | "jump"
  | "doublejump"
  | "coin"
  | "stomp"
  | "powerup"
  | "hurt"
  | "death"
  | "complete"
  | "brick"
  | "extralife"
  | "button"
  | "dash"
  | "punch"
  | "blackflash"
  | "walljump"
  | "splash"
  | "swim";

type Wave = OscillatorType;

/**
 * Procedural chiptune audio — every sound is synthesized with the Web Audio API,
 * so there are zero audio asset files (and nothing to license). Provides retro
 * SFX, a looping background tune, and a persisted mute toggle.
 *
 * Browsers block audio until a user gesture, so call `unlock()` from the first
 * key/pointer event; everything is a no-op until then and never throws.
 */
/** Master gain when SFX are at full volume and unmuted (leaves headroom). */
const SFX_BASE_GAIN = 0.6;

/** Master gain for the synthesized menu music (kept soft and unobtrusive). */
const MUSIC_BASE_GAIN = 0.85;

class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /** Separate bus for the menu music so it follows the *music* volume slider. */
  private musicBus: GainNode | null = null;
  private muted = false;
  private sfxVolume = 1;
  private musicVolume = 1;
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
        this.musicBus = this.ctx.createGain();
        this.muted = saveState.isMuted();
        this.sfxVolume = saveState.getSfxVolume();
        this.musicVolume = saveState.getMusicVolume();
        this.master.gain.value = this.currentGain();
        this.musicBus.gain.value = this.currentMusicGain();
        this.master.connect(this.ctx.destination);
        this.musicBus.connect(this.ctx.destination);
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

  /** Effective master gain, honouring both the mute flag and the SFX volume. */
  private currentGain(): number {
    return this.muted ? 0 : SFX_BASE_GAIN * this.sfxVolume;
  }

  /** Effective menu-music gain, honouring the mute flag and the music volume. */
  private currentMusicGain(): number {
    return this.muted ? 0 : MUSIC_BASE_GAIN * this.musicVolume;
  }

  /** Push the current mute/volume state into both live gain nodes. */
  private applyGains(): void {
    if (this.master) this.master.gain.value = this.currentGain();
    if (this.musicBus) this.musicBus.gain.value = this.currentMusicGain();
  }

  /** Toggle mute, persist it, and return the new state. */
  toggleMute(): boolean {
    this.muted = !this.muted;
    this.applyGains();
    saveState.setMuted(this.muted);
    return this.muted;
  }

  /**
   * Re-read the persisted mute + SFX volume into the live audio graph. `unlock()`
   * captures these on the first user gesture, which happens *before* the player's
   * save has loaded from the backend — call this once the save is in to apply it.
   */
  syncFromSave(): void {
    this.muted = saveState.isMuted();
    this.sfxVolume = saveState.getSfxVolume();
    this.musicVolume = saveState.getMusicVolume();
    this.applyGains();
  }

  /** Re-read the persisted music volume (the settings slider just changed it). */
  syncMusicVolume(): void {
    this.musicVolume = saveState.getMusicVolume();
    this.applyGains();
  }

  /** Current sound-effects volume, 0..1. */
  getSfxVolume(): number {
    return this.sfxVolume;
  }

  /** Set (and persist) the sound-effects volume, applying it live. */
  setSfxVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    this.applyGains();
    saveState.setSfxVolume(this.sfxVolume);
  }

  // ----- SFX -----

  /** Schedule a single enveloped oscillator note. */
  private tone(
    freq: number,
    freqEnd: number,
    dur: number,
    type: Wave,
    gain: number,
    when: number,
    opts: { dest?: GainNode | null; attack?: number } = {}
  ): void {
    const dest = opts.dest ?? this.master;
    if (!this.ctx || !dest) return;
    const attack = opts.attack ?? 0.012;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (freqEnd > 0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), when + dur);
    }
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(gain, when + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(env);
    env.connect(dest);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  /**
   * A short filtered white-noise burst (for whooshes and splashes, which
   * plain oscillators can't fake convincingly).
   */
  private noise(
    dur: number,
    gain: number,
    when: number,
    filterFrom: number,
    filterTo: number
  ): void {
    if (!this.ctx || !this.master) return;
    const len = Math.ceil(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(filterFrom, when);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, filterTo), when + dur);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(gain, when + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(filter);
    filter.connect(env);
    env.connect(this.master);
    src.start(when);
    src.stop(when + dur + 0.02);
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
      case "doublejump":
        // A brighter, airier "whoosh" up — distinct from the ground jump.
        this.tone(520, 1180, 0.18, "triangle", 0.18, t);
        this.tone(880, 1500, 0.12, "square", 0.1, t + 0.02);
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
      case "button":
        // Plain, soft UI click for menu buttons — short and unobtrusive.
        this.tone(520, 400, 0.07, "sine", 0.22, t);
        break;
      case "dash":
        // Shadow dash: a dark whoosh — noise sweep + a falling growl.
        this.noise(0.22, 0.26, t, 2600, 220);
        this.tone(340, 90, 0.2, "sawtooth", 0.12, t);
        break;
      case "punch":
        // Divergent Fist: a snappy air-cutting jab + a low body thump.
        this.noise(0.07, 0.2, t, 1900, 700);
        this.tone(170, 60, 0.11, "square", 0.18, t + 0.01);
        break;
      case "blackflash":
        // Black Flash: a deep crack with a falling growl — heavier than
        // the dash whoosh, felt as much as heard.
        this.noise(0.2, 0.32, t, 3600, 140);
        this.tone(130, 45, 0.28, "sawtooth", 0.22, t);
        this.tone(75, 32, 0.34, "square", 0.2, t + 0.05);
        break;
      case "walljump":
        // A gripping scuff + upward kick, distinct from the ground jump.
        this.noise(0.08, 0.14, t, 1400, 500);
        this.tone(300, 680, 0.14, "square", 0.16, t + 0.02);
        break;
      case "splash":
        // Water entry: a broadband splash with a low "bloop" underneath.
        this.noise(0.3, 0.3, t, 3200, 300);
        this.tone(300, 90, 0.22, "sine", 0.18, t + 0.02);
        break;
      case "swim":
        // One paddle stroke — a soft, watery blub.
        this.noise(0.1, 0.1, t, 900, 300);
        this.tone(220, 420, 0.1, "sine", 0.12, t);
        break;
    }
  }

  // ----- Menu music -----

  /**
   * A calm, loopable progression (Cmaj7 → Am7 → Fmaj7 → G) for the menus:
   * one soft bass note per chord plus a slow sine arpeggio. Routed through the
   * music bus, so it follows the "Musik" volume slider, not the SFX one.
   */
  private static readonly MENU_CHORDS: Array<{ bass: number; notes: number[] }> = [
    { bass: 130.81, notes: [261.63, 329.63, 392.0, 493.88] }, // Cmaj7
    { bass: 110.0, notes: [220.0, 261.63, 329.63, 392.0] }, // Am7
    { bass: 87.31, notes: [174.61, 220.0, 261.63, 329.63] }, // Fmaj7
    { bass: 98.0, notes: [196.0, 246.94, 293.66, 392.0] }, // G
  ];
  /** Arpeggio pattern over the chord tones per 8-step bar (-1 = rest). */
  private static readonly MENU_ARP = [0, 1, 2, 3, 2, 3, 1, -1];
  /** Steps per bar (one chord) and pacing — slow enough to feel relaxed. */
  private static readonly MENU_STEPS_PER_BAR = 8;
  private static readonly MENU_STEP_MS = 320;

  /** Start the relaxed menu loop (no-op if already running or audio is locked-out). */
  startMenuMusic(): void {
    if (this.musicTimer !== null) return;
    this.musicStep = 0;
    this.musicTimer = setInterval(() => {
      // Until the first user gesture the context is suspended and its clock is
      // frozen — skip scheduling so notes don't pile up at the same timestamp.
      if (!this.ctx || this.ctx.state !== "running") return;
      const t = this.ctx.currentTime + 0.02;
      const perBar = AudioManager.MENU_STEPS_PER_BAR;
      const chords = AudioManager.MENU_CHORDS;
      const chord =
        chords[Math.floor(this.musicStep / perBar) % chords.length];
      const pos = this.musicStep % perBar;
      if (pos === 0) {
        // Soft, long bass under the whole bar.
        this.tone(chord.bass, 0, 2.4, "sine", 0.12, t, {
          dest: this.musicBus,
          attack: 0.09,
        });
      }
      const arpIdx = AudioManager.MENU_ARP[pos];
      if (arpIdx >= 0) {
        this.tone(chord.notes[arpIdx], 0, 0.6, "sine", 0.1, t, {
          dest: this.musicBus,
          attack: 0.06,
        });
      }
      this.musicStep++;
    }, AudioManager.MENU_STEP_MS);
  }

  stopMenuMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

export const audioManager = new AudioManager();
