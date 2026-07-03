import Phaser from "phaser";
import { TextureKeys } from "@/config/AssetKeys";
import { Physics } from "@/config/PhysicsConfig";
import type { Player } from "@/entities/Player";
import { Enemy } from "./Enemy";

/** Half-width (px) of the trigger column under the icicle. */
const TRIGGER_HALF_WIDTH = 26;
/** Warning shudder before the drop (ms). */
const SHAKE_MS = 280;

/** Display scale of the 30x18 ice-graded spike art. */
const ICICLE_SCALE = 1.5;
/** Physics body in source px (the spike tips), bottom-aligned. */
const ICICLE_BODY_W = 24;
const ICICLE_BODY_H = 13;

type IcicleState = "hanging" | "shaking" | "falling";

/**
 * Icicle: a frozen ceiling trap. Hangs from the underside of a platform;
 * when the player walks underneath it shudders for a beat, then breaks loose
 * and falls. It hurts on contact (never stompable — it's a spike) and
 * shatters when it hits the ground (the scene owns that collider + effect).
 *
 * Spawn position is the ceiling anchor point (underside of the platform).
 */
export class Icicle extends Enemy {
  public readonly stompable = false;

  private mode: IcicleState = "hanging";

  constructor(
    scene: Phaser.Scene,
    ceilingX: number,
    ceilingY: number,
    private readonly player: Player
  ) {
    super(scene, ceilingX, ceilingY, TextureKeys.Icicle);
    this.setScale(ICICLE_SCALE);
    this.body.setAllowGravity(false);
    this.setCollideWorldBounds(false);
    // Feet-anchored origin: hang so the sprite's top touches the ceiling.
    this.setY(ceilingY + this.displayHeight);
    this.body.setSize(ICICLE_BODY_W, ICICLE_BODY_H);
    this.body.setOffset(
      (this.width - ICICLE_BODY_W) / 2,
      this.height - ICICLE_BODY_H
    );
  }

  /** True once the icicle has broken loose (the terrain collider is armed). */
  public get isFalling(): boolean {
    return this.mode === "falling";
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (this.dying) return;
    if (this.mode === "falling") {
      // Fell into a pit without hitting terrain: clean up quietly.
      if (this.y > this.scene.physics.world.bounds.bottom + 100) this.destroy();
      return;
    }
    if (this.mode !== "hanging" || this.player.isDead) return;

    // Trigger: the player passes through the column directly below.
    const inColumn = Math.abs(this.player.x - this.x) <= TRIGGER_HALF_WIDTH;
    if (inColumn && this.player.y > this.y) {
      this.mode = "shaking";
      this.scene.tweens.add({
        targets: this,
        x: this.x + 2,
        duration: 40,
        yoyo: true,
        repeat: Math.floor(SHAKE_MS / 80),
        onComplete: () => this.drop(),
      });
    }
  }

  private drop(): void {
    if (this.dying) return;
    this.mode = "falling";
    this.body.setAllowGravity(true);
    this.setGravityY(Physics.GRAVITY_Y);
  }

  /** Hit the ground: vanish. The scene spawns the shatter effect + sound. */
  public shatter(): void {
    if (this.dying) return;
    this.dying = true;
    this.body.enable = false;
    this.destroy();
  }
}
