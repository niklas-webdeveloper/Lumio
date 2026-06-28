import Phaser from "phaser";
import { SceneKeys } from "@/config/AssetKeys";
import { GAME_WIDTH, GAME_HEIGHT } from "@/config/GameConfig";

/**
 * GameScene: the core gameplay scene.
 * Milestone 1 placeholder — it renders a confirmation screen and a live FPS
 * counter so we can verify the engine boots and holds 60 FPS. Real gameplay
 * (player, tilemap, entities) is layered in from Milestone 2 onward.
 */
export class GameScene extends Phaser.Scene {
  private fpsText!: Phaser.GameObjects.Text;

  constructor() {
    super(SceneKeys.Game);
  }

  create(): void {
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, "LUMIO'S LEAP", {
        fontFamily: "monospace",
        fontSize: "32px",
        color: "#6ad7ff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 16, "Milestone 1 — engine online", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#c0c0d0",
      })
      .setOrigin(0.5);

    // Live FPS readout (top-left) to validate the 60 FPS target.
    this.fpsText = this.add.text(8, 8, "", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#9be36d",
    });
  }

  update(): void {
    this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);
  }
}
