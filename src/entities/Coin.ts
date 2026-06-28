import Phaser from "phaser";
import { TextureKeys } from "@/config/AssetKeys";

/**
 * A collectible coin. Spins in place (scaleX flip) and, when overlapped by the
 * player, plays a quick pop-and-fade before removing itself. `collect()` returns
 * true only on the first call so the scene counts each coin exactly once.
 */
export class Coin extends Phaser.Physics.Arcade.Sprite {
  public declare body: Phaser.Physics.Arcade.StaticBody;
  private collected = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TextureKeys.Coin);
    scene.add.existing(this);
    scene.physics.add.existing(this, true); // static body (no gravity)

    // Continuous "spin" by flipping horizontal scale back and forth.
    scene.tweens.add({
      targets: this,
      scaleX: { from: 1, to: 0.2 },
      duration: 420,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
      delay: Phaser.Math.Between(0, 300),
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
