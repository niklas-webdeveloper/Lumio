import Phaser from "phaser";
import { TextureKeys } from "@/config/AssetKeys";
import { WorldAnim } from "@/config/worldArt";
import { Enemy } from "./Enemy";

/** Vertical emerge/retract speed (px/s). */
const RISE_SPEED = 90;
/** How long the slime stays fully out / fully hidden (ms). */
const UP_TIME = 1300;
const DOWN_TIME = 1600;

/** Display scale for the 16px-world SunnyLand slimer art in the 32px world. */
const SNAPVINE_SCALE = 2;
/** Physics body in source px (inside the goo, bottom-aligned to the base). */
const SNAPVINE_BODY_W = 19;
const SNAPVINE_BODY_H = 17;

type SnapState = "down" | "rising" | "up" | "lowering";

/**
 * Snapvine: a grumpy slime (SunnyLand "Slimer") that lives in a pipe. It oozes
 * out of the mouth, wobbles menacingly, then sinks back, on a loop. It hurts on
 * contact and cannot be stomped. While retracted it is hidden behind the pipe
 * and harmless.
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
    this.setScale(SNAPVINE_SCALE);
    // Forgiving hitbox a bit inside the goo; Arcade scales it with the sprite.
    this.body.setSize(SNAPVINE_BODY_W, SNAPVINE_BODY_H);
    this.body.setOffset(
      (this.width - SNAPVINE_BODY_W) / 2,
      this.height - SNAPVINE_BODY_H
    );
    this.play(WorldAnim.snapvineIdle); // constant wobble, even while moving

    // Feet at the mouth + display height => the slime sits below the rim (hidden).
    this.hiddenY = mouthY + this.displayHeight;
    this.upY = mouthY;
    this.setY(this.hiddenY);
    this.body.enable = false;

    this.phase = "down";
    this.timer = DOWN_TIME + Phaser.Math.Between(0, 800); // stagger multiple slimes
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
        if ((this.timer -= delta) <= 0) {
          this.phase = "lowering";
        }
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
