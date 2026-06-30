import Phaser from "phaser";
import { SceneKeys } from "@/config/AssetKeys";
import { GAME_WIDTH, GAME_HEIGHT, applyDesignViewport, Fonts } from "@/config/GameConfig";
import { HeroPortrait } from "@/config/characterAssets";
import { UiTex } from "@/config/uiAssets";
import { saveState } from "@/systems/SaveState";
import { MenuBackdrop } from "@/systems/MenuBackdrop";
import { createIconButton } from "@/systems/IconButton";
import { fadeIn, fadeOutThen } from "@/systems/transition";

/**
 * Home screen: sleek gradient backdrop, the (kept) character portrait, a big
 * PLAY button into the level select, plus quick settings/info — styled with the
 * provided UI art kit and the hand-drawn title font.
 */
export class MenuScene extends Phaser.Scene {
  private backdrop!: MenuBackdrop;

  constructor() {
    super(SceneKeys.Menu);
  }

  create(): void {
    applyDesignViewport(this);
    fadeIn(this);
    this.backdrop = new MenuBackdrop(this);

    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, 64, "LUMIO'S LEAP", {
        fontFamily: Fonts.title,
        fontSize: "58px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setStroke("#3a2c63", 10)
      .setShadow(0, 6, "#0009", 12);
    this.add
      .text(cx, 104, "a bright platforming adventure", {
        fontFamily: Fonts.body,
        fontSize: "13px",
        color: "#cdd9ec",
        fontStyle: "600",
      })
      .setOrigin(0.5);

    // Character portrait (kept) on a soft glow disc, gently bobbing.
    const px = cx - 150;
    const py = 232;
    this.add.circle(px, py + 12, 78, 0x000000, 0.22);
    this.add.circle(px, py, 74, 0x8fe0ff, 0.12);
    const hero = this.add.image(px, py, HeroPortrait.key).setScale(1.35);
    this.tweens.add({
      targets: hero,
      y: py - 9,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });

    // Big PLAY button + high score.
    createIconButton(this, cx + 120, 196, UiTex.btnPlay, {
      size: 120,
      onClick: () => this.start(),
    });
    this.add
      .text(cx + 120, 268, "PLAY", {
        fontFamily: Fonts.body,
        fontSize: "26px",
        color: "#ffffff",
        fontStyle: "800",
      })
      .setOrigin(0.5)
      .setShadow(0, 3, "#0007", 4);
    this.add
      .text(cx + 120, 304, `High Score   ${saveState.getHighScore()}`, {
        fontFamily: Fonts.body,
        fontSize: "15px",
        color: "#ffe6a8",
        fontStyle: "700",
      })
      .setOrigin(0.5);

    // Quick settings / info in the top-right corner.
    createIconButton(this, GAME_WIDTH - 36, 34, UiTex.btnInfo, {
      size: 44,
      onClick: () => this.showInfo(),
    });

    this.add
      .text(cx, GAME_HEIGHT - 18, "Press SPACE / ENTER to play", {
        fontFamily: Fonts.body,
        fontSize: "12px",
        color: "#aebbd0",
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH - 6, GAME_HEIGHT - 5, "character by Kibyra · UI kit", {
        fontFamily: Fonts.body,
        fontSize: "9px",
        color: "#8294ad",
      })
      .setOrigin(1, 1);

    this.input.keyboard?.once("keydown-SPACE", () => this.start());
    this.input.keyboard?.once("keydown-ENTER", () => this.start());
  }

  override update(): void {
    this.backdrop.update(this.cameras.main);
  }

  private start(): void {
    fadeOutThen(this, () => this.scene.start(SceneKeys.LevelSelect));
  }

  private showInfo(): void {
    // Lightweight toast; a full settings panel could use panel_config.
    const t = this.add
      .text(GAME_WIDTH / 2, 150, "Arrows/WASD move · Space jump (x2!) · Shift run", {
        fontFamily: Fonts.body,
        fontSize: "13px",
        color: "#ffffff",
        backgroundColor: "#0008",
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setDepth(50);
    this.tweens.add({ targets: t, alpha: 0, delay: 1800, duration: 500, onComplete: () => t.destroy() });
  }
}
