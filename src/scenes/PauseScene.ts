import Phaser from "phaser";
import { SceneKeys } from "@/config/AssetKeys";
import { GAME_WIDTH, GAME_HEIGHT, applyDesignViewport, Fonts } from "@/config/GameConfig";
import { UiTex } from "@/config/uiAssets";
import { createIconButton } from "@/systems/IconButton";

/**
 * Pause overlay (launched on top of a paused GameScene), built from the Pause
 * panel sprite + Resume / Restart / Home buttons. Resuming un-pauses gameplay.
 */
export class PauseScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Pause);
  }

  create(): void {
    applyDesignViewport(this);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0d1117, 0.55).setOrigin(0, 0);

    const cx = GAME_WIDTH / 2;
    this.add.image(cx, 170, UiTex.panelPause).setDisplaySize(250, 308);

    this.add
      .text(cx, 150, "Take a breather", {
        fontFamily: Fonts.body,
        fontSize: "14px",
        color: "#dfe8f5",
        fontStyle: "700",
      })
      .setOrigin(0.5);

    const y = 218;
    createIconButton(this, cx - 76, y, UiTex.btnPlay, { size: 64, label: "Resume", labelSize: 15, onClick: () => this.resumeGame() });
    createIconButton(this, cx, y, UiTex.btnRestart, { size: 56, label: "Retry", labelSize: 15, onClick: () => this.restart() });
    createIconButton(this, cx + 74, y, UiTex.btnHome, { size: 56, label: "Home", labelSize: 15, onClick: () => this.home() });

    const resume = () => this.resumeGame();
    this.input.keyboard?.once("keydown-P", resume);
    this.input.keyboard?.once("keydown-ESC", resume);
  }

  private resumeGame(): void {
    this.scene.stop();
    this.scene.resume(SceneKeys.Game);
  }

  private restart(): void {
    this.scene.stop();
    this.scene.start(SceneKeys.Game); // re-inits the current level (lives/score kept)
  }

  private home(): void {
    this.scene.stop(SceneKeys.UI);
    this.scene.stop(SceneKeys.Game);
    this.scene.stop();
    this.scene.start(SceneKeys.Menu);
  }
}
