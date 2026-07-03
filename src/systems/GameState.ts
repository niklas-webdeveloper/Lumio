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

class GameState {
  lives: number = Progression.START_LIVES;
  score = 0;
  coins = 0;
  levelIndex = 0;
  /** Stopwatch: seconds elapsed in the current level attempt (float). */
  timeElapsed = 0;
  /** Coins collected in the current level attempt (drives the star goal). */
  levelCoins = 0;
  /** Total collectible coins in the current level (set by GameScene on load). */
  levelCoinTotal = 0;

  /** Begin a brand-new game, optionally continuing from a level index. */
  startNewGame(levelIndex = 0): void {
    this.lives = Progression.START_LIVES;
    this.score = 0;
    this.coins = 0;
    this.levelIndex = levelIndex;
    this.timeElapsed = 0;
    this.levelCoins = 0;
    this.levelCoinTotal = 0;
  }

  /** Reset the stopwatch + level coin count for the start (or restart) of a level. */
  startLevelTimer(): void {
    this.timeElapsed = 0;
    this.levelCoins = 0;
  }

  /** Collect a coin: adds score and grants a life every 100 coins. */
  addCoin(): { extraLife: boolean } {
    this.coins += 1;
    this.levelCoins += 1;
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
    return this.lives <= 0;
  }

  /** Advance the stopwatch (runs while the level is being played). */
  tickTime(deltaMs: number): void {
    this.timeElapsed += deltaMs / 1000;
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
