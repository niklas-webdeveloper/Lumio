/**
 * Persistent progress in localStorage: the highest unlocked level and the best
 * score. All access is guarded so the game still runs if storage is unavailable
 * (e.g. private mode). Kept tiny and serializable for easy extension.
 */

import type { CharacterId } from "@/config/characterAssets";
import { CHARACTERS } from "@/config/characterAssets";
import { LEVEL_COUNT } from "@/config/levels";

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
  /** Account coin balance: every coin ever collected, minus shop purchases. */
  totalCoins: number;
  /** Characters unlocked in the shop ("lumio" is always owned). */
  ownedCharacters: CharacterId[];
  /** The character the player has picked to play as. */
  selectedCharacter: CharacterId;
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
  totalCoins: 0,
  ownedCharacters: ["lumio"],
  selectedCharacter: "lumio",
};

class SaveState {
  private cache: SaveData | null = null;
  public currentUsername: string | null = null;

  constructor() {
    // A debounced coin sync (persistSoon) still pending when the tab closes
    // or goes to background would be lost — flush it with a beacon, which
    // survives page teardown. visibilitychange covers mobile/tab-switch
    // cases where pagehide never fires.
    window.addEventListener("pagehide", () => this.flushPendingSync());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.flushPendingSync();
    });
  }

  /** Send a pending debounced save via beacon (safe during page teardown). */
  private flushPendingSync(): void {
    if (!this.syncTimer || !this.currentUsername) return;
    clearTimeout(this.syncTimer);
    this.syncTimer = null;
    const sanitized = this.currentUsername.replace(/[^a-zA-Z0-9_\-]/g, "").toLowerCase();
    navigator.sendBeacon(
      `/api/saves/${sanitized}`,
      new Blob([JSON.stringify(this.load())], { type: "application/json" })
    );
  }

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

    // Clamp the unlock ceiling into the valid range. Progression is earned:
    // clearing a level unlocks the next one (older saves keep what they had).
    this.cache.unlockedLevel = Math.max(
      0,
      Math.min(this.cache.unlockedLevel ?? 0, LEVEL_COUNT - 1)
    );
    // JSON round-trips array holes/undefined as null — normalize to numbers.
    this.cache.levelStars = (this.cache.levelStars ?? []).map((v) => v ?? 0);
    this.cache.bestTimes = (this.cache.bestTimes ?? []).map((v) => v ?? 0);
    this.cache.bestCoins = (this.cache.bestCoins ?? []).map((v) => v ?? 0);
    // Older saves predate the marathon mode — normalize the missing field.
    this.cache.bestMarathon = this.cache.bestMarathon ?? null;
    // Older saves predate per-channel volume — default to full volume.
    this.cache.musicVolume = clamp01(this.cache.musicVolume ?? 1);
    this.cache.sfxVolume = clamp01(this.cache.sfxVolume ?? 1);
    // Older saves predate the character shop — normalize coins & ownership.
    this.cache.totalCoins = Math.max(0, Math.floor(this.cache.totalCoins ?? 0));
    const owned = new Set<CharacterId>(this.cache.ownedCharacters ?? []);
    owned.add("lumio");
    this.cache.ownedCharacters = [...owned].filter((id) => id in CHARACTERS);
    // A selected character must exist and be owned, else fall back to Lumio.
    const sel = this.cache.selectedCharacter;
    this.cache.selectedCharacter =
      sel && this.cache.ownedCharacters.includes(sel) ? sel : "lumio";
  }

  /** Pending debounced backend sync (see persistSoon). */
  private syncTimer: ReturnType<typeof setTimeout> | null = null;

  /** While > 0, persist() only marks dirty; batch() flushes once at the end. */
  private batchDepth = 0;
  private batchDirty = false;

  /**
   * Run several record/unlock calls as a single persist. A level completion
   * records time, stars, coins, score and the unlock — without batching each
   * of those would fire its own backend POST.
   */
  batch(fn: () => void): void {
    this.batchDepth += 1;
    try {
      fn();
    } finally {
      this.batchDepth -= 1;
      if (this.batchDepth === 0 && this.batchDirty) {
        this.batchDirty = false;
        this.persist();
      }
    }
  }

  private persist(): void {
    if (this.batchDepth > 0) {
      this.batchDirty = true;
      return;
    }
    this.writeLocal();
    this.postRemote();
  }

  /**
   * Persist for high-frequency updates (one per collected coin): localStorage
   * is written immediately, the backend POST is debounced so a coin streak
   * results in a single request instead of one per coin.
   */
  private persistSoon(): void {
    this.writeLocal();
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => this.postRemote(), 1500);
  }

  private writeLocal(): void {
    if (!this.currentUsername) return;
    const sanitized = this.currentUsername.replace(/[^a-zA-Z0-9_\-]/g, "").toLowerCase();
    try {
      localStorage.setItem(`lumios-leap.save.${sanitized}`, JSON.stringify(this.load()));
    } catch {
      /* storage unavailable — progress simply isn't persisted */
    }
  }

  private postRemote(): void {
    if (!this.currentUsername) return;
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    const sanitized = this.currentUsername.replace(/[^a-zA-Z0-9_\-]/g, "").toLowerCase();
    fetch(`/api/saves/${sanitized}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(this.load()),
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

  // ----- Character shop (account coin balance + owned/selected characters) -----

  /** Account coin balance (every coin ever collected, minus purchases). */
  getTotalCoins(): number {
    return this.load().totalCoins ?? 0;
  }

  /** Credit collected coins to the account balance (debounced backend sync). */
  addTotalCoins(count: number): void {
    const data = this.load();
    data.totalCoins = (data.totalCoins ?? 0) + count;
    this.persistSoon();
  }

  getOwnedCharacters(): CharacterId[] {
    return this.load().ownedCharacters ?? ["lumio"];
  }

  isCharacterOwned(id: CharacterId): boolean {
    return this.getOwnedCharacters().includes(id);
  }

  /**
   * Buy a character from the account balance. Returns true on success (enough
   * coins, not already owned); the new character is selected right away.
   */
  buyCharacter(id: CharacterId, price: number): boolean {
    const data = this.load();
    if (this.isCharacterOwned(id)) return false;
    if ((data.totalCoins ?? 0) < price) return false;
    data.totalCoins -= price;
    data.ownedCharacters = [...this.getOwnedCharacters(), id];
    data.selectedCharacter = id;
    this.persist();
    return true;
  }

  getSelectedCharacter(): CharacterId {
    const data = this.load();
    const sel = data.selectedCharacter ?? "lumio";
    return this.isCharacterOwned(sel) ? sel : "lumio";
  }

  /** Pick the character to play as (must be owned). Returns true if applied. */
  setSelectedCharacter(id: CharacterId): boolean {
    if (!this.isCharacterOwned(id)) return false;
    this.load().selectedCharacter = id;
    this.persist();
    return true;
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
