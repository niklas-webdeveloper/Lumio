import Phaser from "phaser";
import { SceneKeys } from "@/config/AssetKeys";
import { GAME_WIDTH, GAME_HEIGHT, applyDesignViewport, Fonts } from "@/config/GameConfig";
import { UiTex } from "@/config/uiAssets";
import { gameState } from "@/systems/GameState";
import { saveState } from "@/systems/SaveState";
import { createIconButton } from "@/systems/IconButton";
import { fadeIn, fadeOutThen } from "@/systems/transition";

/**
 * Shown when lives reach zero. Uses a kit-styled panel (drawn to match the
 * sprite panels, since the pack has no "Game Over" panel) + Retry / Home.
 */
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.GameOver);
  }

  create(): void {
    applyDesignViewport(this);
    fadeIn(this);
    const isRecord = saveState.recordScore(gameState.score);
    const cx = GAME_WIDTH / 2;

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x14101c, 0.7).setOrigin(0, 0);

    // Panel drawn in the kit style (dark body, thick outline, corner accent).
    const px = cx - 145;
    const py = 70;
    const pw = 290;
    const ph = 230;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(px + 4, py + 8, pw, ph, 22);
    g.fillStyle(0x6f6979, 1);
    g.fillRoundedRect(px, py, pw, ph, 22);
    g.fillStyle(0x57525f, 1);
    g.fillRoundedRect(px + 12, py + 12, pw - 24, ph - 24, 16);
    g.fillStyle(0x7c7689, 0.6); // corner accent circle
    g.fillCircle(px + pw - 30, py + ph - 30, 46);
    g.fillStyle(0x57525f, 1);
    g.fillRoundedRect(px + 12, py + 12, pw - 24, ph - 24, 16);
    g.lineStyle(5, 0x241f30, 1);
    g.strokeRoundedRect(px, py, pw, ph, 22);

    // Lavender title plate.
    const plate = this.add.graphics();
    plate.fillStyle(0xb6a3cb, 1);
    plate.fillRoundedRect(cx - 110, py - 26, 220, 52, 12);
    plate.lineStyle(4, 0x241f30, 1);
    plate.strokeRoundedRect(cx - 110, py - 26, 220, 52, 12);
    this.add
      .text(cx, py, "GAME OVER", {
        fontFamily: Fonts.title,
        fontSize: "30px",
        color: "#3a2c52",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, py + 70, `Score   ${gameState.score}`, {
        fontFamily: Fonts.body,
        fontSize: "18px",
        color: "#ffffff",
        fontStyle: "800",
      })
      .setOrigin(0.5);
    this.add
      .text(cx, py + 98, isRecord ? "New High Score!" : `Best   ${saveState.getHighScore()}`, {
        fontFamily: Fonts.body,
        fontSize: "14px",
        color: "#ffe08a",
        fontStyle: "700",
      })
      .setOrigin(0.5);

    createIconButton(this, cx - 46, py + 158, UiTex.btnRestart, { size: 60, label: "Retry", labelSize: 14, onClick: () => this.retry() });
    createIconButton(this, cx + 46, py + 158, UiTex.btnHome, { size: 60, label: "Home", labelSize: 14, onClick: () => this.home() });

    this.input.keyboard?.once("keydown-SPACE", () => this.retry());
    this.input.keyboard?.once("keydown-ENTER", () => this.retry());
    this.input.keyboard?.once("keydown-ESC", () => this.home());
  }

  private retry(): void {
    gameState.startNewGame(gameState.levelIndex);
    fadeOutThen(this, () => this.scene.start(SceneKeys.Game));
  }

  private home(): void {
    fadeOutThen(this, () => this.scene.start(SceneKeys.Menu));
  }
}
