import Phaser from "phaser";
import { TextureKeys } from "@/config/AssetKeys";
import { WorldAnim } from "@/config/worldArt";
import { Enemy } from "./Enemy";

/** Horizontal cruise speed (px/s). */
const VULTURE_SPEED = 68;
/** Sine-bob amplitude (px) and angular frequency (rad/s) of the flight wave. */
const BOB_AMPLITUDE = 12;
const BOB_FREQ = 2.6;
/** Default patrol half-range around the spawn point (px). */
const DEFAULT_RANGE = 128;

/** Display scale of the 29x30 SunnyLand vulture art in the 32px world. */
const VULTURE_SCALE = 1.5;
/** Physics body in source px (inside the feathers), centered on the wings. */
const VULTURE_BODY_W = 22;
const VULTURE_BODY_H = 15;

/**
 * Vulture: a desert flyer. Glides back and forth over a fixed patrol range
 * around its spawn point, riding a lazy sine wave. Ignores terrain (it's in
 * the open air) and gravity. Defeated by a stomp — timing the bounce off its
 * back is the intended way past it.
 */
export class Vulture extends Enemy {
  public readonly stompable = true;

  private direction: 1 | -1 = -1;
  private readonly minX: number;
  private readonly maxX: number;
  /** Phase of the sine bob (randomized so flocks don't sync up). */
  private phase = Math.random() * Math.PI * 2;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    rangePx: number = DEFAULT_RANGE
  ) {
    super(scene, x, y, TextureKeys.Vulture);
    this.setScale(VULTURE_SCALE);
    this.body.setAllowGravity(false);
    // Body centered on the wingspan (the art anchors at the feet).
    this.body.setSize(VULTURE_BODY_W, VULTURE_BODY_H);
    this.body.setOffset(
      (this.width - VULTURE_BODY_W) / 2,
      (this.height - VULTURE_BODY_H) / 2
    );
    this.play(WorldAnim.vultureFly);
    this.minX = x - rangePx;
    this.maxX = x + rangePx;
    this.setVelocityX(VULTURE_SPEED * this.direction);
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (this.dying) return;

    // Turn at the patrol edges (or if something ever blocks the way).
    if (this.x <= this.minX || this.body.blocked.left) this.direction = 1;
    else if (this.x >= this.maxX || this.body.blocked.right) this.direction = -1;

    this.phase += (delta / 1000) * BOB_FREQ;
    this.setVelocityX(VULTURE_SPEED * this.direction);
    this.setVelocityY(Math.cos(this.phase) * BOB_AMPLITUDE * BOB_FREQ);
    this.setFlipX(this.direction === 1); // art faces left by default
  }
}
