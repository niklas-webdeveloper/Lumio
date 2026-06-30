import Phaser from "phaser";
import { SceneKeys } from "@/config/AssetKeys";
import { GAME_WIDTH, applyDesignViewport } from "@/config/GameConfig";
import { LEVELS } from "@/config/levels";
import { gameState } from "@/systems/GameState";
import { saveState } from "@/systems/SaveState";
import { ParallaxBackground } from "@/systems/ParallaxBackground";
import { createButton } from "@/systems/UiButton";
import { fadeIn, fadeOutThen } from "@/systems/transition";

interface Card {
  container: Phaser.GameObjects.Container;
  graphics: Phaser.GameObjects.Graphics;
  locked: boolean;
}

const CARD_W = 128;
const CARD_H = 156;
const CARD_GAP = 22;

/**
 * Level select: one card per level, unlocked progressively (level 1 is always
 * open; finishing a level unlocks the next). Navigable by mouse or keyboard
 * (←/→ to choose, Enter to play, Esc to go back).
 */
export class LevelSelectScene extends Phaser.Scene {
  private parallax!: ParallaxBackground;
  private cards: Card[] = [];
  private selected = 0;
  private unlocked = 0;

  constructor() {
    super(SceneKeys.LevelSelect);
  }

  create(): void {
    applyDesignViewport(this);
    fadeIn(this);
    this.parallax = new ParallaxBackground(this);
    this.cards = [];
    this.unlocked = saveState.getUnlockedLevel();
    this.selected = Math.min(this.unlocked, LEVELS.length - 1);

    this.add
      .text(GAME_WIDTH / 2, 48, "SELECT LEVEL", {
        fontFamily: "'Nunito', sans-serif",
        fontSize: "34px",
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#1c6b8c",
        strokeThickness: 7,
      })
      .setOrigin(0.5);

    const totalW = LEVELS.length * CARD_W + (LEVELS.length - 1) * CARD_GAP;
    const startX = (GAME_WIDTH - totalW) / 2 + CARD_W / 2;
    LEVELS.forEach((level, i) => {
      this.cards.push(
        this.createCard(startX + i * (CARD_W + CARD_GAP), 168, i, level.title)
      );
    });

    createButton(this, 84, 322, {
      width: 130,
      height: 42,
      label: "Back",
      fontSize: 16,
      color: 0x2a7d9c,
      hoverColor: 0x3a9cc0,
      onClick: () => this.back(),
    });
    this.add
      .text(GAME_WIDTH - 12, 332, "Arrows choose - Enter play - Esc back", {
        fontFamily: "'Nunito', sans-serif",
        fontSize: "11px",
        color: "#0d3b4d",
      })
      .setOrigin(1, 0.5);

    this.refresh();
    this.setupKeys();
  }

  override update(): void {
    this.parallax.update(this.cameras.main);
  }

  private createCard(x: number, y: number, index: number, title: string): Card {
    const locked = index > this.unlocked;
    const container = this.add.container(x, y);
    const graphics = this.add.graphics();

    const numText = this.add
      .text(0, -44, `${index + 1}`, {
        fontFamily: "'Nunito', sans-serif",
        fontSize: "44px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const nameText = this.add
      .text(0, 6, title, {
        fontFamily: "'Nunito', sans-serif",
        fontSize: "13px",
        color: "#ffffff",
        align: "center",
        wordWrap: { width: CARD_W - 18 },
      })
      .setOrigin(0.5);
    const status = this.add
      .text(0, 52, locked ? "LOCKED" : index < this.unlocked ? "CLEARED" : "PLAY", {
        fontFamily: "'Nunito', sans-serif",
        fontSize: "13px",
        color: locked ? "#dfe6ee" : "#eaffef",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    container.add([graphics, numText, nameText, status]);
    container.setSize(CARD_W, CARD_H);
    container.setInteractive(
      new Phaser.Geom.Rectangle(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H),
      Phaser.Geom.Rectangle.Contains
    );
    container.on("pointerover", () => this.select(index));
    container.on("pointerdown", () => this.tryPlay(index));

    return { container, graphics, locked };
  }

  /** Redraw a card's background to reflect locked + selected state. */
  private drawCard(card: Card, selected: boolean): void {
    const g = card.graphics;
    const w = CARD_W;
    const h = CARD_H;
    const base = card.locked ? 0x66707e : 0x2f9e54;
    const top = card.locked ? 0x7e8896 : 0x46c06c;
    g.clear();
    g.fillStyle(0x000000, 0.28);
    g.fillRoundedRect(-w / 2 + 3, -h / 2 + 5, w, h, 16);
    g.fillStyle(base, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
    g.fillStyle(top, 1); // header band
    g.fillRoundedRect(-w / 2, -h / 2, w, h / 2, 16);
    g.fillStyle(0xffffff, 0.18); // gloss
    g.fillRoundedRect(-w / 2 + 5, -h / 2 + 5, w - 10, 26, 10);
    const borderColor = selected ? 0xffe14a : 0xffffff;
    g.lineStyle(selected ? 5 : 3, borderColor, selected ? 1 : 0.85);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
    card.container.setScale(selected ? 1.06 : 1);
  }

  private refresh(): void {
    this.cards.forEach((c, i) => this.drawCard(c, i === this.selected));
  }

  private select(index: number): void {
    this.selected = Phaser.Math.Clamp(index, 0, this.cards.length - 1);
    this.refresh();
  }

  private tryPlay(index: number): void {
    const card = this.cards[index];
    this.select(index);
    if (card.locked) {
      // Nudge to signal it's locked.
      this.tweens.add({
        targets: card.container,
        x: card.container.x + 6,
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
