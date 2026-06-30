import Phaser from "phaser";
import { SceneKeys } from "@/config/AssetKeys";
import { GAME_WIDTH, GAME_HEIGHT, applyDesignViewport } from "@/config/GameConfig";
import { HeroPortrait } from "@/config/characterAssets";
import { saveState } from "@/systems/SaveState";
import { MenuBackdrop } from "@/systems/MenuBackdrop";
import { createButton } from "@/systems/UiButton";
import { fadeIn, fadeOutThen } from "@/systems/transition";

/**
 * Home screen: sleek modern gradient backdrop, the character portrait, a big PLAY
 * button leading to the level select, and the persisted high score.
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

    // Title with a soft shadow.
    this.add
      .text(cx, 70, "LUMIO'S LEAP", {
        fontFamily: "'Fredoka', sans-serif",
        fontSize: "52px",
        color: "#ffffff",
        fontStyle: "700",
        stroke: "#16608a",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setShadow(0, 6, "#0008", 10);
    this.add
      .text(cx, 108, "a bright platforming adventure", {
        fontFamily: "'Nunito', sans-serif",
        fontSize: "13px",
        color: "#dbeef5",
      })
      .setOrigin(0.5);

    // Character portrait on a soft disc, gently bobbing.
    const discX = cx - 150;
    const discY = 230;
    this.add.circle(discX, discY + 10, 74, 0x000000, 0.18); // soft shadow disc
    this.add.circle(discX, discY, 70, 0x8fe0ff, 0.12); // soft glow
    const hero = this.add.image(discX, discY, HeroPortrait.key).setScale(1.25);
    this.tweens.add({
      targets: hero,
      y: discY - 8,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });

    // Primary actions.
    const btnX = cx + 110;
    createButton(this, btnX, 195, {
      width: 230,
      height: 66,
      label: "PLAY",
      fontSize: 26,
      onClick: () => this.goToLevelSelect(),
    });
    createButton(this, btnX, 272, {
      width: 230,
      height: 50,
      label: `High Score  ${saveState.getHighScore()}`,
      fontSize: 16,
      color: 0x2a7d9c,
      hoverColor: 0x2a7d9c,
      onClick: () => this.goToLevelSelect(),
    });

    this.add
      .text(cx, GAME_HEIGHT - 28, "Press SPACE / ENTER to play", {
        fontFamily: "'Nunito', sans-serif",
        fontSize: "13px",
        color: "#dbeef5",
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH - 6, GAME_HEIGHT - 6, "character by Kibyra", {
        fontFamily: "'Nunito', sans-serif",
        fontSize: "9px",
        color: "#dbeef5aa",
      })
      .setOrigin(1, 1);

    this.input.keyboard?.once("keydown-SPACE", () => this.goToLevelSelect());
    this.input.keyboard?.once("keydown-ENTER", () => this.goToLevelSelect());
  }

  override update(): void {
    this.backdrop.update(this.cameras.main); // keep the god-rays drifting
  }

  private goToLevelSelect(): void {
    fadeOutThen(this, () => this.scene.start(SceneKeys.LevelSelect));
  }
}
