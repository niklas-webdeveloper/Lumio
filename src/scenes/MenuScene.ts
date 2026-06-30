import Phaser from "phaser";
import { SceneKeys } from "@/config/AssetKeys";
import { GAME_WIDTH, GAME_HEIGHT } from "@/config/GameConfig";
import { HeroPortrait } from "@/config/characterAssets";
import { saveState } from "@/systems/SaveState";
import { ParallaxBackground } from "@/systems/ParallaxBackground";
import { createButton } from "@/systems/UiButton";
import { fadeIn, fadeOutThen } from "@/systems/transition";

/**
 * Home screen: lush parallax backdrop, the character portrait, a big PLAY
 * button leading to the level select, and the persisted high score.
 */
export class MenuScene extends Phaser.Scene {
  private parallax!: ParallaxBackground;

  constructor() {
    super(SceneKeys.Menu);
  }

  create(): void {
    fadeIn(this);
    this.parallax = new ParallaxBackground(this);

    const cx = GAME_WIDTH / 2;

    // Title with a soft shadow.
    this.add
      .text(cx, 70, "LUMIO'S LEAP", {
        fontFamily: "monospace",
        fontSize: "46px",
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#1c6b8c",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setShadow(0, 4, "#00000055", 6);
    this.add
      .text(cx, 108, "a bright platforming adventure", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#0d3b4d",
      })
      .setOrigin(0.5);

    // Character portrait on a soft disc, gently bobbing.
    const discX = cx - 150;
    const discY = 230;
    this.add.circle(discX, discY + 6, 70, 0x0d3b4d, 0.18);
    const hero = this.add.image(discX, discY, HeroPortrait.key).setScale(1.2);
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
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#0d3b4d",
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH - 6, GAME_HEIGHT - 6, "character by Kibyra", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#0d3b4d99",
      })
      .setOrigin(1, 1);

    this.input.keyboard?.once("keydown-SPACE", () => this.goToLevelSelect());
    this.input.keyboard?.once("keydown-ENTER", () => this.goToLevelSelect());
  }

  override update(): void {
    this.parallax.update(0); // keep the god-rays drifting
  }

  private goToLevelSelect(): void {
    fadeOutThen(this, () => this.scene.start(SceneKeys.LevelSelect));
  }
}
