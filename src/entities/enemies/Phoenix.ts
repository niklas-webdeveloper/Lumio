import Phaser from "phaser";
import { TextureKeys, EnemyAnim } from "@/config/AssetKeys";
import { Enemy } from "./Enemy";

/** Horizontal cruise speed (px/s). */
const PHOENIX_SPEED = 70;
/** Sine-bob amplitude (px) and angular frequency (rad/s) of the drift. */
const BOB_AMPLITUDE = 16;
const BOB_FREQ = 2.2;
/** Default patrol half-range around the spawn point (px). */
const DEFAULT_RANGE = 128;

/**
 * Phoenix: the JJK flying enemy of level 6. A fiery bird that soars back and
 * forth over a fixed patrol range on a lazy sine wave, wings beating through an
 * 18-frame flight cycle, wrapped in a warm ember aura. Ignores gravity/terrain;
 * defeated by a stomp.
 */
export class Phoenix extends Enemy {
  public readonly stompable = true;

  private direction: 1 | -1 = -1;
  private readonly minX: number;
  private readonly maxX: number;
  private phase = Math.random() * Math.PI * 2;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    rangePx: number = DEFAULT_RANGE
  ) {
    super(scene, x, y, TextureKeys.Phoenix);
    this.setScale(0.85);
    this.body.setAllowGravity(false);
    // Body on the torso, centered on the cell (art anchors at the feet).
    this.body.setSize(30, 28);
    this.body.setOffset((this.width - 30) / 2, (this.height - 28) / 2);
    this.play(EnemyAnim.phoenixFly);
    this.minX = x - rangePx;
    this.maxX = x + rangePx;
    this.setVelocityX(PHOENIX_SPEED * this.direction);

    const glow = this.preFX?.addGlow(0xff7a1e, 2, 0, false, 0.1, 12);
    if (glow) {
      scene.tweens.add({
        targets: glow,
        outerStrength: 4.2,
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
    }
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (this.dying) return;

    if (this.x <= this.minX || this.body.blocked.left) this.direction = 1;
    else if (this.x >= this.maxX || this.body.blocked.right) this.direction = -1;

    this.phase += (delta / 1000) * BOB_FREQ;
    this.setVelocityX(PHOENIX_SPEED * this.direction);
    this.setVelocityY(Math.cos(this.phase) * BOB_AMPLITUDE * BOB_FREQ);
    this.setFlipX(this.direction === 1); // art faces left by default
  }
}
