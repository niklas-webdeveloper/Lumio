import Phaser from "phaser";
import { SceneKeys } from "@/config/AssetKeys";
import { GAME_WIDTH, GAME_HEIGHT, applyDesignViewport } from "@/config/GameConfig";
import { gameState } from "@/systems/GameState";
import { saveState } from "@/systems/SaveState";
import { fadeIn, fadeOutThen } from "@/systems/transition";

/** Shown when lives reach zero. Reports the final/high score; returns to menu. */
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.GameOver);
  }

  create(): void {
    applyDesignViewport(this);
    fadeIn(this);
    const isRecord = saveState.recordScore(gameState.score);

    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x1a0d11, 0.82)
      .setOrigin(0, 0);

    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, 110, "GAME OVER", {
        fontFamily: "'Nunito', sans-serif",
        fontSize: "40px",
        color: "#ff8aa0",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 168, `Score: ${gameState.score}`, {
        fontFamily: "'Nunito', sans-serif",
        fontSize: "18px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.add
      .text(
        cx,
        196,
        isRecord
          ? "New High Score!"
          : `High Score: ${saveState.getHighScore()}`,
        {
          fontFamily: "'Nunito', sans-serif",
          fontSize: "14px",
          color: "#ffe08a",
        }
      )
      .setOrigin(0.5);

    const prompt = this.add
      .text(cx, 256, "Press SPACE — Back to Menu", {
        fontFamily: "'Nunito', sans-serif",
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: "#00000066",
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: prompt,
      alpha: { from: 1, to: 0.5 },
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    const toMenu = () => fadeOutThen(this, () => this.scene.start(SceneKeys.Menu));
    this.input.keyboard?.once("keydown-SPACE", toMenu);
    this.input.keyboard?.once("keydown-ENTER", toMenu);
  }
}
