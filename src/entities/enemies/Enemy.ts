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
    this.scene.tweens.add({
      targets: this,
      scaleY: 0.15,
      y: this.y + 10,
      alpha: 0.5,
      duration: 160,
      ease: "Quad.out",
      onComplete: () => this.destroy(),
    });
  }
}
