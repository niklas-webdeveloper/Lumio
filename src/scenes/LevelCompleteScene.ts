import Phaser from "phaser";
import { SceneKeys } from "@/config/AssetKeys";
import { GAME_WIDTH, GAME_HEIGHT, applyDesignViewport, Fonts } from "@/config/GameConfig";
import { UiTex, starsTexture } from "@/config/uiAssets";
import { gameState } from "@/systems/GameState";
import { createIconButton } from "@/systems/IconButton";
import { fadeIn, fadeOutThen } from "@/systems/transition";

interface LevelCompleteData {
  bonus: number;
  lastLevel: boolean;
  stars: number;
}

/** Shown after reaching the beacon: the Completed panel, star rating, score. */
export class LevelCompleteScene extends Phaser.Scene {
  private payload!: LevelCompleteData;

  constructor() {
    super(SceneKeys.LevelComplete);
  }

  init(data: LevelCompleteData): void {
    this.payload = data;
  }

  create(): void {
    applyDesignViewport(this);
    fadeIn(this);
    const cx = GAME_WIDTH / 2;

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0d1117, 0.62).setOrigin(0, 0);
    this.add.image(cx, 178, UiTex.panelCompleted).setDisplaySize(286, 324);

    // Star rating — pops in with a little bounce.
    const stars = this.add
      .image(cx, 118, starsTexture(this.payload.stars))
      .setDisplaySize(170, 60);
    const finalScale = stars.scale;
    stars.setScale(0);
    this.tweens.add({
      targets: stars,
      scale: finalScale,
      duration: 420,
      ease: "Back.out",
      delay: 150,
    });

    this.add
      .text(cx, 168, this.payload.lastLevel ? "You beat the game!" : "Level Cleared!", {
        fontFamily: Fonts.title,
        fontSize: "24px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.add
      .text(cx, 196, `Score ${gameState.score}   (+${this.payload.bonus} time)`, {
        fontFamily: Fonts.body,
        fontSize: "13px",
        color: "#dfe8f5",
        fontStyle: "700",
      })
      .setOrigin(0.5);

    // Action buttons.
    const y = 256;
    if (this.payload.lastLevel) {
      createIconButton(this, cx - 40, y, UiTex.btnRestart, { size: 56, onClick: () => this.replay() });
      createIconButton(this, cx + 40, y, UiTex.btnHome, { size: 56, onClick: () => this.home() });
    } else {
      createIconButton(this, cx - 76, y, UiTex.btnRestart, { size: 56, onClick: () => this.replay() });
      createIconButton(this, cx, y, UiTex.btnHome, { size: 56, onClick: () => this.home() });
      createIconButton(this, cx + 76, y, UiTex.btnNext, { size: 64, onClick: () => this.next() });
    }

    this.input.keyboard?.once("keydown-SPACE", () => this.next());
    this.input.keyboard?.once("keydown-ENTER", () => this.next());
    this.input.keyboard?.once("keydown-ESC", () => this.home());
  }

  private next(): void {
    if (this.payload.lastLevel) {
      this.home();
    } else {
      gameState.advanceLevel();
      fadeOutThen(this, () => this.scene.start(SceneKeys.Game));
    }
  }

  private replay(): void {
    gameState.startNewGame(gameState.levelIndex);
    fadeOutThen(this, () => this.scene.start(SceneKeys.Game));
  }

  private home(): void {
    fadeOutThen(this, () => this.scene.start(SceneKeys.Menu));
  }
}
