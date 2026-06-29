import Phaser from "phaser";
import { SceneKeys } from "@/config/AssetKeys";
import { GAME_WIDTH, GAME_HEIGHT } from "@/config/GameConfig";
import { gameState } from "@/systems/GameState";
import { fadeIn, fadeOutThen } from "@/systems/transition";

interface LevelCompleteData {
  bonus: number;
  lastLevel: boolean;
}

/** Shown after reaching the beacon: time bonus, total score, and what's next. */
export class LevelCompleteScene extends Phaser.Scene {
  private payload!: LevelCompleteData;

  constructor() {
    super(SceneKeys.LevelComplete);
  }

  init(data: LevelCompleteData): void {
    this.payload = data;
  }

  create(): void {
    fadeIn(this);
    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0d1117, 0.78)
      .setOrigin(0, 0);

    const cx = GAME_WIDTH / 2;
    const title = this.payload.lastLevel ? "YOU WIN!" : "LEVEL COMPLETE!";

    this.add
      .text(cx, 96, title, {
        fontFamily: "monospace",
        fontSize: "36px",
        color: "#9be35a",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 156, `Time Bonus: +${this.payload.bonus}`, {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#ffe08a",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 184, `Score: ${gameState.score}`, {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const prompt = this.payload.lastLevel
      ? "Press SPACE — Back to Menu"
      : "Press SPACE — Next Level";
    const promptText = this.add
      .text(cx, 256, prompt, {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: "#00000066",
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: promptText,
      alpha: { from: 1, to: 0.5 },
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    this.input.keyboard?.once("keydown-SPACE", () => this.advance());
    this.input.keyboard?.once("keydown-ENTER", () => this.advance());
  }

  private advance(): void {
    if (this.payload.lastLevel) {
      fadeOutThen(this, () => this.scene.start(SceneKeys.Menu));
    } else {
      gameState.advanceLevel();
      fadeOutThen(this, () => this.scene.start(SceneKeys.Game));
    }
  }
}
