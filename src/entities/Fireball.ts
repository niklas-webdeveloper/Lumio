import Phaser from "phaser";
import { TextureKeys } from "@/config/AssetKeys";

/** Horizontal speed of a mini fireball (px/s). */
const FIREBALL_SPEED = 460;
/** Lifetime before a fireball fizzles out on its own (ms). */
const FIREBALL_LIFETIME_MS = 900;

/**
 * A mini fireball from the fire-burst item. Flies straight in the fired
 * direction with a slight sine wobble, spins, and dies on walls, enemies or
 * after its lifetime. The scene wires up the overlaps/colliders.
 */
export class Fireball extends Phaser.Physics.Arcade.Sprite {
  public declare body: Phaser.Physics.Arcade.Body;
  private done = false;
  private readonly baseY: number;
  private age = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, direction: 1 | -1) {
    super(scene, x, y, TextureKeys.Fireball);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.baseY = y;
    this.body.setAllowGravity(false);
    this.body.setCircle(5, 1, 1);
    this.setVelocityX(FIREBALL_SPEED * direction);

    scene.tweens.add({ targets: this, angle: 360 * direction, duration: 400, repeat: -1 });
    scene.time.delayedCall(FIREBALL_LIFETIME_MS, () => this.explode(false));
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (this.done) return;
    this.age += delta;
    // Slight vertical wobble so a burst reads as a swarm, not a straight line.
    this.y = this.baseY + Math.sin(this.age / 60) * 4;
  }

  /** Remove the fireball with (optionally) a little flash. */
  explode(flash = true): void {
    if (this.done) return;
    this.done = true;
    this.body.enable = false;
    if (!this.scene) return;
    if (flash) {
      this.scene.tweens.add({
        targets: this,
        scale: 2,
        alpha: 0,
        duration: 120,
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
