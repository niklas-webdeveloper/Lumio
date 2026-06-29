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
  LEVEL_TIME: 300, // seconds allotted per level
  TIME_BONUS_PER_SEC: 10, // points per leftover second on completion
} as const;

class GameState {
  lives: number = Progression.START_LIVES;
  score = 0;
  coins = 0;
  levelIndex = 0;
  /** Seconds remaining in the current level (float; display rounded up). */
  timeLeft: number = Progression.LEVEL_TIME;

  /** Begin a brand-new game, optionally continuing from a level index. */
  startNewGame(levelIndex = 0): void {
    this.lives = Progression.START_LIVES;
    this.score = 0;
    this.coins = 0;
    this.levelIndex = levelIndex;
    this.timeLeft = Progression.LEVEL_TIME;
  }

  /** Reset the countdown for the start (or restart) of a level. */
  startLevelTimer(): void {
    this.timeLeft = Progression.LEVEL_TIME;
  }

  /** Collect a coin: adds score and grants a life every 100 coins. */
  addCoin(): { extraLife: boolean } {
    this.coins += 1;
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

  /** Advance the countdown. Returns true when time has run out. */
  tickTime(deltaMs: number): boolean {
    this.timeLeft = Math.max(0, this.timeLeft - deltaMs / 1000);
    return this.timeLeft <= 0;
  }

  /** Award the end-of-level time bonus and return the points added. */
  awardTimeBonus(): number {
    const bonus = Math.floor(this.timeLeft) * Progression.TIME_BONUS_PER_SEC;
    this.score += bonus;
    return bonus;
  }

  advanceLevel(): void {
    this.levelIndex += 1;
  }
}

export const gameState = new GameState();
