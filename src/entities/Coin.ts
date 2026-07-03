import Phaser from "phaser";
import { TextureKeys } from "@/config/AssetKeys";
import { WorldAnim, WorldSheet } from "@/config/worldArt";

/**
 * A collectible coin — a golden gem that plays its sparkle animation in place.
 * When overlapped by the player it plays a quick pop-and-fade before removing
 * itself. `collect()` returns true only on the first call so the scene counts
 * each coin exactly once.
 */
/**
 * Collection hit-box (px), a bit larger than the 26px gem art so a coin is
 * picked up the moment the (visually much wider) player touches it — the tight
 * body felt like it "missed" coins on contact. Kept under the 32px coin spacing
 * so a pickup never grabs an adjacent coin.
 */
const COIN_HITBOX = 30;

export class Coin extends Phaser.Physics.Arcade.Sprite {
  public declare body: Phaser.Physics.Arcade.StaticBody;
  private collected = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TextureKeys.Coin);
    scene.add.existing(this);
    scene.physics.add.existing(this, true); // static body (no gravity)
    // Widen the pickup area and keep it centered on the coin.
    this.body.setSize(COIN_HITBOX, COIN_HITBOX);

    // Sparkle loop, de-synced so rows of coins don't blink in unison.
    this.play({
      key: WorldAnim.coinSpin,
      startFrame: Phaser.Math.Between(0, WorldSheet.coin.frames - 1),
    });
  }

  /** Collect the coin. Returns true the first time only. */
  collect(): boolean {
    if (this.collected) return false;
    this.collected = true;
    this.body.enable = false;
    this.scene.tweens.killTweensOf(this);

    this.scene.tweens.add({
      targets: this,
      y: this.y - 24,
      alpha: 0,
      scaleX: 1,
      duration: 220,
      ease: "Quad.out",
      onComplete: () => this.destroy(),
    });
    return true;
  }
}
