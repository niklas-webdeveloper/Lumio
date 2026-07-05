/**
 * Persistent progress in localStorage: the highest unlocked level and the best
 * score. All access is guarded so the game still runs if storage is unavailable
 * (e.g. private mode). Kept tiny and serializable for easy extension.
 */

/** Result of a completed marathon run (all levels back to back). */
export interface MarathonRecord {
  /** Total run time in seconds (including failed attempts). */
  time: number;
  /** Coins collected across the whole run. */
  coins: number;
  /** Lives lost during the run. */
  deaths: number;
}

export interface SaveData {
  /** Highest level index the player may continue from (0-based). */
  unlockedLevel: number;
  highScore: number;
  muted: boolean;
  /** Background-music volume, 0..1. */
  musicVolume: number;
  /** Sound-effects volume, 0..1. */
  sfxVolume: number;
  /** Best star rating (0..3) earned per level index. */
  levelStars: number[];
  /** Best (lowest) completion time in seconds per level index; 0 = none yet. */
  bestTimes: number[];
  /** Most coins collected in a single clear per level index. */
  bestCoins: number[];
  /** Fastest completed marathon run; null until the first clear. */
  bestMarathon: MarathonRecord | null;
}

const DEFAULT_SAVE: SaveData = {
  unlockedLevel: 0,
  highScore: 0,
  muted: false,
  musicVolume: 1,
  sfxVolume: 1,
  levelStars: [],
  bestTimes: [],
  bestCoins: [],
  bestMarathon: null,
};

class SaveState {
  private cache: SaveData | null = null;
  public currentUsername: string | null = null;

  /** Read the save (cached after first load). */
  load(): SaveData {
    if (this.cache) return this.cache;
    return { ...DEFAULT_SAVE };
  }

  async setUsername(username: string): Promise<void> {
    this.currentUsername = username;
    const sanitized = username.replace(/[^a-zA-Z0-9_\-]/g, "").toLowerCase();

    // Try to load from backend first
    try {
      const response = await fetch(`/api/saves/${sanitized}`);
      if (response.ok) {
        this.cache = await response.json();
      } else {
        throw new Error("Backend response not ok");
      }
    } catch (err) {
      console.warn("Failed to load save state from backend, trying local storage fallback", err);
      // Fallback to local storage
      try {
        const raw = localStorage.getItem(`lumios-leap.save.${sanitized}`);
        this.cache = raw
          ? { ...DEFAULT_SAVE, ...(JSON.parse(raw) as Partial<SaveData>) }
          : { ...DEFAULT_SAVE };
      } catch {
        this.cache = { ...DEFAULT_SAVE };
      }
    }

    if (!this.cache) {
      this.cache = { ...DEFAULT_SAVE };
    }

    // Always unlock all levels (level-01 through level-04)
    this.cache.unlockedLevel = 3;
    // JSON round-trips array holes/undefined as null — normalize to numbers.
    this.cache.levelStars = (this.cache.levelStars ?? []).map((v) => v ?? 0);
    this.cache.bestTimes = (this.cache.bestTimes ?? []).map((v) => v ?? 0);
    this.cache.bestCoins = (this.cache.bestCoins ?? []).map((v) => v ?? 0);
    // Older saves predate the marathon mode — normalize the missing field.
    this.cache.bestMarathon = this.cache.bestMarathon ?? null;
    // Older saves predate per-channel volume — default to full volume.
    this.cache.musicVolume = clamp01(this.cache.musicVolume ?? 1);
    this.cache.sfxVolume = clamp01(this.cache.sfxVolume ?? 1);
  }

  private persist(): void {
    if (!this.currentUsername) return;
    const sanitized = this.currentUsername.replace(/[^a-zA-Z0-9_\-]/g, "").toLowerCase();
    const data = this.load();

    try {
      localStorage.setItem(`lumios-leap.save.${sanitized}`, JSON.stringify(data));
    } catch {
      /* storage unavailable — progress simply isn't persisted */
    }

    fetch(`/api/saves/${sanitized}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }).catch((err) => {
      console.error("Failed to persist save state to backend:", err);
    });
  }

  /** Unlock a level (only ever raises the unlocked ceiling). */
  unlockLevel(index: number): void {
    const data = this.load();
    if (index > data.unlockedLevel) {
      data.unlockedLevel = index;
      this.persist();
    }
  }

  getUnlockedLevel(): number {
    return this.load().unlockedLevel;
  }

  /** Record a score if it beats the stored best. Returns true if it was a record. */
  recordScore(score: number): boolean {
    const data = this.load();
    if (score > data.highScore) {
      data.highScore = score;
      this.persist();
      return true;
    }
    return false;
  }

  getHighScore(): number {
    return this.load().highScore;
  }

  /** Best stars earned for a level (0 if never cleared). */
  getLevelStars(index: number): number {
    return this.load().levelStars[index] ?? 0;
  }

  /** Record a star rating for a level, keeping the best. Returns true if improved. */
  recordLevelStars(index: number, stars: number): boolean {
    const data = this.load();
    if (stars > (data.levelStars[index] ?? 0)) {
      data.levelStars[index] = stars;
      this.persist();
      return true;
    }
    return false;
  }

  /** Best completion time for a level in seconds, or null if never cleared. */
  getBestTime(index: number): number | null {
    const t = this.load().bestTimes[index] ?? 0;
    return t > 0 ? t : null;
  }

  /**
   * Record a completion time, keeping the fastest. Returns true when this run
   * set a new best (including the very first clear).
   */
  recordBestTime(index: number, seconds: number): boolean {
    const data = this.load();
    const prev = data.bestTimes[index] ?? 0;
    if (prev <= 0 || seconds < prev) {
      data.bestTimes[index] = seconds;
      this.persist();
      return true;
    }
    return false;
  }

  /** Most coins ever collected in a single clear of a level. */
  getBestCoins(index: number): number {
    return this.load().bestCoins[index] ?? 0;
  }

  /** Record a per-clear coin count, keeping the highest. */
  recordBestCoins(index: number, coins: number): void {
    const data = this.load();
    if (coins > (data.bestCoins[index] ?? 0)) {
      data.bestCoins[index] = coins;
      this.persist();
    }
  }

  /** Fastest completed marathon run, or null if never finished one. */
  getBestMarathon(): MarathonRecord | null {
    return this.load().bestMarathon;
  }

  /**
   * Record a completed marathon run, keeping the fastest. Returns true when
   * this run set a new best (including the very first clear).
   */
  recordMarathon(time: number, coins: number, deaths: number): boolean {
    const data = this.load();
    if (!data.bestMarathon || time < data.bestMarathon.time) {
      data.bestMarathon = { time, coins, deaths };
      this.persist();
      return true;
    }
    return false;
  }

  isMuted(): boolean {
    return this.load().muted;
  }

  setMuted(muted: boolean): void {
    this.load().muted = muted;
    this.persist();
  }

  /** Background-music volume, 0..1. */
  getMusicVolume(): number {
    return clamp01(this.load().musicVolume);
  }

  setMusicVolume(volume: number): void {
    this.load().musicVolume = clamp01(volume);
    this.persist();
  }

  /** Sound-effects volume, 0..1. */
  getSfxVolume(): number {
    return clamp01(this.load().sfxVolume);
  }

  setSfxVolume(volume: number): void {
    this.load().sfxVolume = clamp01(volume);
    this.persist();
  }
}

/** Clamp a value to the 0..1 range (falling back to 1 for non-finite input). */
function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
}

export const saveState = new SaveState();
