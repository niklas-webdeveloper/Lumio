import Phaser from "phaser";
import { SceneKeys } from "@/config/AssetKeys";
import { GAME_WIDTH, GAME_HEIGHT } from "@/config/GameConfig";
import { getLevel } from "@/config/levels";
import { gameState, Progression } from "@/systems/GameState";

/**
 * HUD overlay. Runs in parallel above GameScene and reflects the shared
 * gameState each frame: score, coins, lives, level, and the countdown timer.
 * Also shows a transient level-name title card when (re)launched for a level.
 */
export class UIScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private coinText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;

  constructor() {
    super(SceneKeys.UI);
  }

  create(): void {
    // Translucent top bar for legibility over any background.
    this.add.rectangle(0, 0, GAME_WIDTH, 26, 0x000000, 0.4).setOrigin(0, 0);

    const base: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#ffffff",
    };

    // Left cluster: score, coins, lives.
    this.scoreText = this.add.text(8, 5, "", base);
    this.coinText = this.add.text(118, 5, "", { ...base, color: "#ffe08a" });
    this.livesText = this.add.text(250, 5, "", { ...base, color: "#ff8aa0" });

    // Right cluster: level number, then the timer at the far edge.
    this.timeText = this.add
      .text(GAME_WIDTH - 8, 5, "", { ...base, color: "#9be35a" })
      .setOrigin(1, 0);
    this.levelText = this.add
      .text(GAME_WIDTH - 92, 5, "", base)
      .setOrigin(1, 0);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 6,
        "←→/AD move · Space jump · Shift sprint · P pause",
        { fontFamily: "monospace", fontSize: "10px", color: "#ffffffaa" }
      )
      .setOrigin(0.5, 1);

    this.showLevelTitle();
  }

  /** A centered level-name card that holds briefly, then fades away. */
  private showLevelTitle(): void {
    const title = getLevel(gameState.levelIndex)?.title ?? "";
    const card = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, title, {
        fontFamily: "monospace",
        fontSize: "26px",
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#1a1c2c",
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: card,
      alpha: { from: 1, to: 0 },
      delay: 1100,
      duration: 700,
      onComplete: () => card.destroy(),
    });
  }

  override update(): void {
    this.scoreText.setText(`Score ${gameState.score}`);
    this.coinText.setText(`Coins ${gameState.coins}/${Progression.COINS_PER_LIFE}`);
    this.livesText.setText(`Lives ${Math.max(0, gameState.lives)}`);
    this.timeText.setText(`Time ${Math.ceil(gameState.timeLeft)}`);
    this.levelText.setText(`Lv ${gameState.levelIndex + 1}`);
  }
}
