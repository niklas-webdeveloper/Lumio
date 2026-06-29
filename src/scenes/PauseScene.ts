import Phaser from "phaser";
import { SceneKeys } from "@/config/AssetKeys";
import { GAME_WIDTH, GAME_HEIGHT } from "@/config/GameConfig";

/**
 * Pause overlay. Launched on top of a paused GameScene; resuming stops this
 * scene and un-pauses gameplay. (GameScene re-enables its own input on resume.)
 */
export class PauseScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Pause);
  }

  create(): void {
    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0d1117, 0.6)
      .setOrigin(0, 0);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 14, "PAUSED", {
        fontFamily: "monospace",
        fontSize: "34px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 24, "Press P or Esc to resume", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#c0c0d0",
      })
      .setOrigin(0.5);

    const resume = () => {
      this.scene.resume(SceneKeys.Game);
      this.scene.stop();
    };
    this.input.keyboard?.once("keydown-P", resume);
    this.input.keyboard?.once("keydown-ESC", resume);
  }
}
