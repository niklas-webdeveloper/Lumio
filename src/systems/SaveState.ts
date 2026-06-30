/**
 * Persistent progress in localStorage: the highest unlocked level and the best
 * score. All access is guarded so the game still runs if storage is unavailable
 * (e.g. private mode). Kept tiny and serializable for easy extension.
 */
const STORAGE_KEY = "lumios-leap.save.v1";

export interface SaveData {
  /** Highest level index the player may continue from (0-based). */
  unlockedLevel: number;
  highScore: number;
  muted: boolean;
  /** Best star rating (0..3) earned per level index. */
  levelStars: number[];
}

const DEFAULT_SAVE: SaveData = {
  unlockedLevel: 0,
  highScore: 0,
  muted: false,
  levelStars: [],
};

class SaveState {
  private cache: SaveData | null = null;

  /** Read the save (cached after first load). */
  load(): SaveData {
    if (this.cache) return this.cache;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.cache = raw
        ? { ...DEFAULT_SAVE, ...(JSON.parse(raw) as Partial<SaveData>) }
        : { ...DEFAULT_SAVE };
    } catch {
      this.cache = { ...DEFAULT_SAVE };
    }
    return this.cache;
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.load()));
    } catch {
      /* storage unavailable — progress simply isn't persisted */
    }
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

  isMuted(): boolean {
    return this.load().muted;
  }

  setMuted(muted: boolean): void {
    this.load().muted = muted;
    this.persist();
  }
}

export const saveState = new SaveState();
