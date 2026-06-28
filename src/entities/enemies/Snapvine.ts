import Phaser from "phaser";
import { TextureKeys } from "@/config/AssetKeys";
import { Enemy } from "./Enemy";

/** Vertical emerge/retract speed (px/s). */
const RISE_SPEED = 90;
/** How long the plant stays fully out / fully hidden (ms). */
const UP_TIME = 1300;
const DOWN_TIME = 1600;

type SnapState = "down" | "rising" | "up" | "lowering";

/**
 * Snapvine: a piranha-style plant that lives in a pipe. It rises out of the
 * mouth, snaps at the air, then retracts, on a loop. It hurts on contact and
 * cannot be stomped. While retracted it is hidden behind the pipe and harmless.
 *
 * Position is anchored at the feet (origin 0.5,1); `mouthY` is the pipe-rim Y.
 */
export class Snapvine extends Enemy {
  public readonly stompable = false;

  private phase: SnapState = "down";
  private timer: number;
  private readonly hiddenY: number; // feet Y when fully retracted
  private readonly upY: number; // feet Y when fully extended

  constructor(scene: Phaser.Scene, mouthX: number, mouthY: number) {
    super(scene, mouthX, mouthY + 0, TextureKeys.Snapvine);
    this.body.setAllowGravity(false);
    this.setCollideWorldBounds(false);

    // Feet at the mouth + height => whole plant sits below the rim (hidden).
    this.hiddenY = mouthY + this.height;
    this.upY = mouthY;
    this.setY(this.hiddenY);
    this.body.enable = false;

    this.phase = "down";
    this.timer = DOWN_TIME + Phaser.Math.Between(0, 800); // stagger multiple plants
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (this.dying) return;

    switch (this.phase) {
      case "down":
        this.body.enable = false;
        this.setVelocityY(0);
        if ((this.timer -= delta) <= 0) {
          this.phase = "rising";
          this.body.enable = true;
        }
        break;

      case "rising":
        this.setVelocityY(-RISE_SPEED);
        if (this.y <= this.upY) {
          this.setY(this.upY);
          this.setVelocityY(0);
          this.phase = "up";
          this.timer = UP_TIME;
        }
        break;

      case "up":
        this.setVelocityY(0);
        if ((this.timer -= delta) <= 0) this.phase = "lowering";
        break;

      case "lowering":
        this.setVelocityY(RISE_SPEED);
        if (this.y >= this.hiddenY) {
          this.setY(this.hiddenY);
          this.setVelocityY(0);
          this.phase = "down";
          this.timer = DOWN_TIME;
        }
        break;
    }
  }
}
