import Phaser from "phaser";
import { SceneKeys } from "@/config/AssetKeys";
import { GAME_WIDTH, GAME_HEIGHT } from "@/config/GameConfig";
import {
  createWorldTextures,
  registerPlayerAnimations,
} from "@/systems/TextureFactory";

/**
 * PreloadScene: loads all game assets and shows a progress bar.
 * Currently there are no assets to load (Milestone 1), so it draws the bar
 * once and proceeds. Real asset loading is wired in later milestones.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Preload);
  }

  preload(): void {
    this.createProgressBar();
    // Asset load calls (images, atlases, audio, tilemaps) go here later.
  }

  create(): void {
    // Generate all procedural art now so every later scene can use it by key.
    createWorldTextures(this);
    registerPlayerAnimations(this);
    this.scene.start(SceneKeys.Menu);
  }

  /** Minimal, dependency-free loading bar drawn with the Graphics API. */
  private createProgressBar(): void {
    const barWidth = GAME_WIDTH * 0.6;
    const barHeight = 16;
    const x = (GAME_WIDTH - barWidth) / 2;
    const y = GAME_HEIGHT / 2 - barHeight / 2;

    const border = this.add.graphics();
    border.lineStyle(2, 0xffffff, 0.8);
    border.strokeRect(x - 2, y - 2, barWidth + 4, barHeight + 4);

    const fill = this.add.graphics();

    this.add
      .text(GAME_WIDTH / 2, y - 24, "Loading…", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.load.on("progress", (value: number) => {
      fill.clear();
      fill.fillStyle(0x6ad7ff, 1);
      fill.fillRect(x, y, barWidth * value, barHeight);
    });
  }
}
