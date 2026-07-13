import Phaser from "phaser";

/** Lifetime before an orb fizzles out on its own (ms). */
const ORB_LIFETIME_MS = 4500;

/**
 * A boss projectile: the Monarch's straight aimed shadow bolt or the Kraken's
 * ballistic ink lob (gravityY > 0). Dies on terrain and on the player (the
 * scene wires those up), or after its lifetime.
 */
export class BossOrb extends Phaser.Physics.Arcade.Sprite {
  public declare body: Phaser.Physics.Arcade.Body;
  private done = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    vx: number,
    vy: number,
    opts: { gravityY?: number; additive?: boolean } = {}
  ) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    const r = Math.max(4, this.width / 2 - 2);
    this.body.setCircle(r, this.width / 2 - r, this.height / 2 - r);
    if (opts.gravityY) this.setGravityY(opts.gravityY);
    this.setVelocity(vx, vy);
    if (opts.additive) this.setBlendMode(Phaser.BlendModes.ADD);

    // A slow pulse so the projectile reads as alive/energized.
    scene.tweens.add({
      targets: this,
      scale: { from: 1, to: 1.25 },
      duration: 260,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
    scene.time.delayedCall(ORB_LIFETIME_MS, () => this.pop(false));
  }

  /** Remove the orb with (optionally) a little burst. */
  pop(flash = true): void {
    if (this.done) return;
    this.done = true;
    this.body.enable = false;
    if (!this.scene) return;
    if (flash) {
      this.scene.tweens.killTweensOf(this);
      this.scene.tweens.add({
        targets: this,
        scale: 2,
        alpha: 0,
        duration: 130,
        onComplete: () => this.destroy(),
      });
    } else {
      this.destroy();
    }
  }

  get isDone(): boolean {
    return this.done;
  }
}
