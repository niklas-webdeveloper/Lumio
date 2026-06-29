import Phaser from "phaser";
import { SceneKeys, TextureKeys } from "@/config/AssetKeys";
import { GAME_WIDTH, GAME_HEIGHT } from "@/config/GameConfig";
import { LEVELS } from "@/config/levels";
import { gameState } from "@/systems/GameState";
import { saveState } from "@/systems/SaveState";

/**
 * Title screen. Starts a new game, or continues from the highest unlocked level
 * if the player has made progress. Shows the persisted high score.
 */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Menu);
  }

  create(): void {
    this.add.image(0, 0, TextureKeys.Sky).setOrigin(0, 0);
    this.add
      .tileSprite(0, GAME_HEIGHT, GAME_WIDTH, 220, TextureKeys.HillsNear)
      .setOrigin(0, 1);

    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, 84, "LUMIO'S LEAP", {
        fontFamily: "monospace",
        fontSize: "44px",
        color: "#ffe08a",
        fontStyle: "bold",
        stroke: "#5a3b00",
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 124, "a tiny platforming adventure", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#1a1c2c",
      })
      .setOrigin(0.5);

    const unlocked = saveState.getUnlockedLevel();
    const highScore = saveState.getHighScore();

    const start = this.add
      .text(cx, 196, "Press SPACE — New Game", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#ffffff",
        backgroundColor: "#00000066",
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5);
    // Gentle pulse to draw the eye.
    this.tweens.add({
      targets: start,
      alpha: { from: 1, to: 0.5 },
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    if (unlocked > 0 && unlocked < LEVELS.length) {
      this.add
        .text(cx, 240, `Press C — Continue (Level ${unlocked + 1})`, {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#9be35a",
        })
        .setOrigin(0.5);
    }

    this.add
      .text(cx, 286, `High Score: ${highScore}`, {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#1a1c2c",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, GAME_HEIGHT - 16, "Arrows/WASD move · Space jump · Shift sprint · P pause", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#1a1c2c",
      })
      .setOrigin(0.5);

    // Inputs.
    this.input.keyboard?.once("keydown-SPACE", () => this.begin(0));
    this.input.keyboard?.once("keydown-ENTER", () => this.begin(0));
    if (unlocked > 0 && unlocked < LEVELS.length) {
      this.input.keyboard?.once("keydown-C", () => this.begin(unlocked));
    }
  }

  private begin(levelIndex: number): void {
    gameState.startNewGame(levelIndex);
    this.scene.start(SceneKeys.Game);
  }
}
