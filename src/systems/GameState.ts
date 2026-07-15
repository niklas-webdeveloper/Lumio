/**
 * Central run-state for a single playthrough: lives, score, coins, the current
 * level, and the per-level countdown timer. A module singleton (`gameState`) is
 * shared across scenes — GameScene mutates it, UIScene reads it.
 *
 * Persistent data (unlocked level, high score) lives in SaveState instead.
 */
export const Progression = {
  START_LIVES: 3,
  COINS_PER_LIFE: 100,
  COIN_SCORE: 50, // points per coin
  STOMP_SCORE: 100, // points per enemy stomp
  TIME_BONUS_PER_SEC: 10, // points per second under the level's par time
} as const;

/**
 * "levels": classic mode — one level per run, per-level best times.
 * "marathon": all levels back to back with 3 lives for the whole run; the
 * clock keeps counting across levels *and* failed attempts, a death restarts
 * the current level, game over voids the run.
 * "duel": online race against a friend on one level — the duel clock is wall
 * time since GO (runs on in the DuelClient), deaths restart the level but
 * never end the run, and nothing is saved (no records, no unlocks).
 */
export type GameMode = "levels" | "marathon" | "duel";

/** Stashable special item held in the Mario-Kart-style item slot. */
export type HeldItem = "fireburst" | "star" | null;

class GameState {
  mode: GameMode = "levels";
  lives: number = Progression.START_LIVES;
  score = 0;
  coins = 0;
  levelIndex = 0;
  /** Stopwatch: seconds elapsed in the current level attempt (float). */
  timeElapsed = 0;
  /** Marathon stopwatch: total seconds across all levels and failed attempts. */
  runTime = 0;
  /** Deaths in the current run (shown on the marathon results/leaderboard). */
  deaths = 0;
  /** Coins collected across the whole run (never wraps, unlike `coins`). */
  runCoins = 0;
  /** Coins collected in the current level attempt (drives the star goal). */
  levelCoins = 0;
  /** Total collectible coins in the current level (set by GameScene on load). */
  levelCoinTotal = 0;
  /** Special item in the slot, usable on demand (Mario-Kart style). */
  heldItem: HeldItem = null;
  /** Hits taken in the current level attempt (drives the boss "no damage" star). */
  hitsTaken = 0;

  /** Begin a brand-new game, optionally continuing from a level index. */
  startNewGame(levelIndex = 0, mode: GameMode = "levels"): void {
    this.mode = mode;
    this.lives = Progression.START_LIVES;
    this.score = 0;
    this.coins = 0;
    this.levelIndex = levelIndex;
    this.timeElapsed = 0;
    this.runTime = 0;
    this.deaths = 0;
    this.runCoins = 0;
    this.levelCoins = 0;
    this.levelCoinTotal = 0;
    this.heldItem = null;
  }

  get isMarathon(): boolean {
    return this.mode === "marathon";
  }

  get isDuel(): boolean {
    return this.mode === "duel";
  }

  /** Reset the stopwatch + level coin count for the start (or restart) of a level. */
  startLevelTimer(): void {
    this.timeElapsed = 0;
    this.levelCoins = 0;
    this.heldItem = null;
    this.hitsTaken = 0;
  }

  /**
   * Collect a coin: adds score and grants a life every 100 coins.
   * Coins from random "?" blocks pass `countsTowardGoal: false` — they are a
   * bonus and no longer part of the level's "all coins" star goal.
   */
  addCoin(countsTowardGoal = true): { extraLife: boolean } {
    this.coins += 1;
    if (countsTowardGoal) this.levelCoins += 1;
    this.runCoins += 1;
    this.score += Progression.COIN_SCORE;
    if (this.coins >= Progression.COINS_PER_LIFE) {
      this.coins -= Progression.COINS_PER_LIFE;
      this.lives += 1;
      return { extraLife: true };
    }
    return { extraLife: false };
  }

  addScore(points: number): void {
    this.score += points;
  }

  /** Lose a life. Returns true if that was the last one (game over). */
  loseLife(): boolean {
    this.lives -= 1;
    this.deaths += 1;
    return this.lives <= 0;
  }

  /** Advance the stopwatch (runs while the level is being played). */
  tickTime(deltaMs: number): void {
    this.timeElapsed += deltaMs / 1000;
    this.runTime += deltaMs / 1000;
  }

  /** True when every collectible coin of the current level was picked up. */
  get allLevelCoins(): boolean {
    return this.levelCoinTotal > 0 && this.levelCoins >= this.levelCoinTotal;
  }

  /**
   * Award the end-of-level time bonus: points for every full second the run
   * finished under the level's par time. Returns the points added.
   */
  awardTimeBonus(parTime: number): number {
    const under = Math.max(0, Math.floor(parTime - this.timeElapsed));
    const bonus = under * Progression.TIME_BONUS_PER_SEC;
    this.score += bonus;
    return bonus;
  }

  advanceLevel(): void {
    this.levelIndex += 1;
  }
}

export const gameState = new GameState();
