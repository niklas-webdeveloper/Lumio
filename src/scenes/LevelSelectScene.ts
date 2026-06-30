import Phaser from "phaser";
import { SceneKeys } from "@/config/AssetKeys";
import { GAME_WIDTH, applyDesignViewport, Fonts } from "@/config/GameConfig";
import { LEVELS } from "@/config/levels";
import { UiTex, starsTexture } from "@/config/uiAssets";
import { gameState } from "@/systems/GameState";
import { saveState } from "@/systems/SaveState";
import { MenuBackdrop } from "@/systems/MenuBackdrop";
import { createIconButton } from "@/systems/IconButton";
import { fadeIn, fadeOutThen } from "@/systems/transition";

const SLOT_W = 112;
const SLOT_H = 100;
const SLOT_GAP = 26;

interface Slot {
  container: Phaser.GameObjects.Container;
  x: number;
  locked: boolean;
}

/**
 * Level select built from the UI art kit: the LEVELS title plate and a row of
 * level slots showing the number, earned star rating, and lock state. Navigable
 * by mouse or keyboard (←/→, Enter, Esc); the selection is highlighted.
 */
export class LevelSelectScene extends Phaser.Scene {
  private backdrop!: MenuBackdrop;
  private slots: Slot[] = [];
  private ring!: Phaser.GameObjects.Graphics;
  private selected = 0;
  private unlocked = 0;

  constructor() {
    super(SceneKeys.LevelSelect);
  }

  create(): void {
    applyDesignViewport(this);
    fadeIn(this);
    this.backdrop = new MenuBackdrop(this);
    this.slots = [];
    this.unlocked = saveState.getUnlockedLevel();
    this.selected = Math.min(this.unlocked, LEVELS.length - 1);

    this.add.image(GAME_WIDTH / 2, 58, UiTex.plateLevels).setDisplaySize(300, 92);

    this.ring = this.add.graphics();

    const total = LEVELS.length * SLOT_W + (LEVELS.length - 1) * SLOT_GAP;
    const startLeft = (GAME_WIDTH - total) / 2;
    LEVELS.forEach((level, i) => {
      const cx = startLeft + SLOT_W / 2 + i * (SLOT_W + SLOT_GAP);
      this.slots.push(this.createSlot(cx, 188, i, level.title));
    });

    createIconButton(this, 56, 318, UiTex.btnBack, {
      size: 54,
      onClick: () => this.back(),
    });
    this.add
      .text(GAME_WIDTH - 12, 322, "←/→ choose   Enter play   Esc back", {
        fontFamily: Fonts.body,
        fontSize: "12px",
        color: "#aebbd0",
        fontStyle: "600",
      })
      .setOrigin(1, 0.5);

    this.refresh();
    this.setupKeys();
  }

  override update(): void {
    this.backdrop.update(this.cameras.main);
  }

  private createSlot(cx: number, cy: number, index: number, title: string): Slot {
    const locked = index > this.unlocked;
    const container = this.add.container(cx, cy);

    const slot = this.add.image(0, 0, UiTex.slot).setDisplaySize(SLOT_W, SLOT_H);
    if (locked) slot.setTint(0x4a4a55);
    container.add(slot);

    container.add(
      this.add
        .text(0, -22, `${index + 1}`, {
          fontFamily: Fonts.title,
          fontSize: "44px",
          color: locked ? "#8a8a96" : "#ffffff",
        })
        .setOrigin(0.5)
        .setShadow(0, 3, "#0007", 4)
    );

    if (locked) {
      container.add(
        this.add
          .text(0, 30, "LOCKED", {
            fontFamily: Fonts.body,
            fontSize: "12px",
            color: "#c7c7d2",
            fontStyle: "800",
          })
          .setOrigin(0.5)
      );
    } else {
      // Earned star rating beneath the number.
      const stars = saveState.getLevelStars(index);
      container.add(
        this.add.image(0, 30, starsTexture(stars)).setDisplaySize(74, 26)
      );
    }

    const title2 = this.add
      .text(0, SLOT_H / 2 + 12, title, {
        fontFamily: Fonts.body,
        fontSize: "12px",
        color: locked ? "#9aa3b5" : "#dfe8f5",
        fontStyle: "700",
      })
      .setOrigin(0.5);
    container.add(title2);

    container.setSize(SLOT_W, SLOT_H);
    container.setInteractive(
      new Phaser.Geom.Rectangle(-SLOT_W / 2, -SLOT_H / 2, SLOT_W, SLOT_H),
      Phaser.Geom.Rectangle.Contains
    );
    container.on("pointerover", () => this.select(index));
    container.on("pointerdown", () => this.tryPlay(index));

    return { container, x: cx, locked };
  }

  private refresh(): void {
    this.slots.forEach((s, i) => s.container.setScale(i === this.selected ? 1.08 : 1));
    // Bright selection ring around the active slot.
    const s = this.slots[this.selected];
    const w = SLOT_W * 1.08 + 12;
    const h = SLOT_H * 1.08 + 12;
    this.ring.clear();
    this.ring.lineStyle(5, 0xffe14a, 1);
    this.ring.strokeRoundedRect(s.x - w / 2, 188 - h / 2, w, h, 16);
  }

  private select(index: number): void {
    this.selected = Phaser.Math.Clamp(index, 0, this.slots.length - 1);
    this.refresh();
  }

  private tryPlay(index: number): void {
    const slot = this.slots[index];
    this.select(index);
    if (slot.locked) {
      this.tweens.add({
        targets: slot.container,
        x: slot.x + 6,
        duration: 50,
        yoyo: true,
        repeat: 3,
      });
      return;
    }
    gameState.startNewGame(index);
    fadeOutThen(this, () => this.scene.start(SceneKeys.Game));
  }

  private setupKeys(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    kb.on("keydown-LEFT", () => this.select(this.selected - 1));
    kb.on("keydown-RIGHT", () => this.select(this.selected + 1));
    kb.on("keydown-A", () => this.select(this.selected - 1));
    kb.on("keydown-D", () => this.select(this.selected + 1));
    kb.on("keydown-ENTER", () => this.tryPlay(this.selected));
    kb.on("keydown-SPACE", () => this.tryPlay(this.selected));
    kb.on("keydown-ESC", () => this.back());
  }

  private back(): void {
    fadeOutThen(this, () => this.scene.start(SceneKeys.Menu));
  }
}
