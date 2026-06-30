import Phaser from "phaser";

/**
 * Abstract base for enemies. Provides the shared physics setup, a "dying" guard,
 * the stomp reaction, and a damage gate. Concrete enemies implement their own
 * movement in `preUpdate` and declare whether they can be stomped.
 */
export abstract class Enemy extends Phaser.Physics.Arcade.Sprite {
  public declare body: Phaser.Physics.Arcade.Body;

  /** Whether jumping on this enemy defeats it (vs. hurting the player). */
  public abstract readonly stompable: boolean;

  protected dying = false;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1); // anchored at the feet / base
    this.setCollideWorldBounds(true);
  }

  public get isDying(): boolean {
    return this.dying;
  }

  /** True only while this enemy can currently hurt the player. */
  public canDamage(): boolean {
    return !this.dying && this.body.enable;
  }

  /** Defeated by a stomp: squash flat, then remove. */
  public stomp(): void {
    if (this.dying) return;
    this.dying = true;
    this.setVelocity(0, 0);
    this.body.enable = false;
    // A more realistic, satisfying "squash" animation
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.4, // bulge out
      scaleY: 0.2, // squash flat
      alpha: { from: 1, to: 0 }, // fade out simultaneously
      duration: 150,
      ease: "Power2", // smooth squash
      onComplete: () => {
        // Optional: spawn a small dust puff right where it died
        // (Assuming GameScene has a reference to particles, but since we are in Enemy,
        // we can just destroy it after the tween).
        this.destroy();
      },
    });
  }
}
