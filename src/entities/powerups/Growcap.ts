import Phaser from "phaser";
import { TextureKeys } from "@/config/AssetKeys";
import { WorldAnim } from "@/config/worldArt";
import { Physics } from "@/config/PhysicsConfig";
import { TILE_SIZE } from "@/config/GameConfig";
import type { Player } from "@/entities/Player";

/** Horizontal cruise speed of a roaming Growcap (px/s). */
const GROWCAP_SPEED = 70;

/** Display scale of the 19x16 cherry art (16px-world art in a 32px world). */
const GROWCAP_SCALE = 1.5;

/**
 * The Growcap grow power-up — a plump cherry. Emerges upward out of a block,
 * then rolls along the ground, reversing at walls, until the player touches it
 * and grows. Add it to a group with `runChildUpdate: true` so its movement
 * logic ticks automatically.
 */
export class Growcap extends Phaser.Physics.Arcade.Sprite {
  public declare body: Phaser.Physics.Arcade.Body;
  private emerged = false;
  private direction: 1 | -1 = 1;
  private consumed = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TextureKeys.Growcap);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(0.5, 1); // anchored at its feet
    this.setScale(GROWCAP_SCALE);
    this.play(WorldAnim.growcapIdle);
    this.setCollideWorldBounds(true);
    this.body.setAllowGravity(false);
    this.body.enable = false; // physics off until it finishes emerging

    // Rise one tile out of the block, then start roaming.
    this.scene.tweens.add({
      targets: this,
      y: y - TILE_SIZE,
      duration: 300,
      ease: "Quad.out",
      onComplete: () => this.startRoaming(),
    });
  }

  private startRoaming(): void {
    this.emerged = true;
    this.body.enable = true;
    this.body.setAllowGravity(true);
    this.setGravityY(Physics.GRAVITY_Y);
    this.setVelocityX(GROWCAP_SPEED * this.direction);
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.emerged || this.consumed) return;

    // Reverse at walls.
    if (this.body.blocked.left) this.direction = 1;
    else if (this.body.blocked.right) this.direction = -1;
    this.setVelocityX(GROWCAP_SPEED * this.direction);
  }

  /** Apply the power-up to the player, then disappear. */
  applyTo(player: Player): void {
    if (this.consumed) return;
    this.consumed = true;
    this.body.enable = false;
    player.grow();

    this.scene.tweens.add({
      targets: this,
      y: this.y - 12,
      alpha: 0,
      duration: 200,
      ease: "Quad.out",
      onComplete: () => this.destroy(),
    });
  }
}
