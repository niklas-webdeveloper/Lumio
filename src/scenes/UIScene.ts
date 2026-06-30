import Phaser from "phaser";
import { SceneKeys } from "@/config/AssetKeys";
import { GAME_WIDTH, GAME_HEIGHT, applyDesignViewport, Fonts } from "@/config/GameConfig";
import { getLevel } from "@/config/levels";
import { UiTex } from "@/config/uiAssets";
import { gameState, Progression } from "@/systems/GameState";
import { audioManager } from "@/systems/AudioManager";
import { createIconButton } from "@/systems/IconButton";

/**
 * HUD overlay. Runs in parallel above GameScene and reflects the shared
 * gameState each frame: score, coins, lives, level, and the countdown timer.
 * Also hosts the pause + mute buttons and a transient level-name title card.
 */
export class UIScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private coinText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private soundBtn!: Phaser.GameObjects.Container;

  constructor() {
    super(SceneKeys.UI);
  }

  create(): void {
    applyDesignViewport(this);
    this.add.rectangle(0, 0, GAME_WIDTH, 28, 0x000000, 0.42).setOrigin(0, 0);

    const base: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: Fonts.body,
      fontSize: "15px",
      color: "#ffffff",
      fontStyle: "800",
    };

    this.scoreText = this.add.text(10, 6, "", base);
    this.coinText = this.add.text(124, 6, "", { ...base, color: "#ffe08a" });
    this.livesText = this.add.text(252, 6, "", { ...base, color: "#ff8aa0" });
    this.timeText = this.add
      .text(GAME_WIDTH - 44, 6, "", { ...base, color: "#9be35a" })
      .setOrigin(1, 0);
    this.levelText = this.add
      .text(GAME_WIDTH - 132, 6, "", base)
      .setOrigin(1, 0);

    // Pause (in the bar) + mute (just below it).
    createIconButton(this, GAME_WIDTH - 16, 14, UiTex.btnPause, {
      size: 24,
      onClick: () => this.pause(),
    });
    this.soundBtn = createIconButton(this, GAME_WIDTH - 22, 52, UiTex.btnSound, {
      size: 32,
      onClick: () => this.toggleMute(),
    });
    this.refreshSoundIcon();

    this.showLevelTitle();
  }

  private pause(): void {
    this.scene.launch(SceneKeys.Pause);
    this.scene.pause(SceneKeys.Game);
  }

  private toggleMute(): void {
    const muted = audioManager.toggleMute();
    this.sound.mute = muted; // also mutes the Phaser bgm
    this.refreshSoundIcon();
  }

  private refreshSoundIcon(): void {
    const muted = audioManager.isMuted();
    this.soundBtn.setAlpha(muted ? 0.45 : 1);
  }

  /** A centered level-name card that holds briefly, then fades away. */
  private showLevelTitle(): void {
    const title = getLevel(gameState.levelIndex)?.title ?? "";
    const card = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, title, {
        fontFamily: Fonts.title,
        fontSize: "34px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setStroke("#2a2440", 7)
      .setShadow(0, 4, "#0008", 8);
    card.setScale(0.7);
    this.tweens.add({ targets: card, scale: 1, duration: 320, ease: "Back.out" });
    this.tweens.add({
      targets: card,
      alpha: { from: 1, to: 0 },
      delay: 1300,
      duration: 600,
      onComplete: () => card.destroy(),
    });
  }

  override update(): void {
    this.scoreText.setText(`Score ${gameState.score}`);
    this.coinText.setText(`Coins ${gameState.coins}/${Progression.COINS_PER_LIFE}`);
    this.livesText.setText(`Lives ${Math.max(0, gameState.lives)}`);
    this.timeText.setText(`Time ${Math.ceil(gameState.timeLeft)}`);
    this.levelText.setText(`Lv ${gameState.levelIndex + 1}`);
  }
}
