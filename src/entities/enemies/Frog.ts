import Phaser from "phaser";
import { TextureKeys, EnemyAnim } from "@/config/AssetKeys";
import { FROG_FRAME } from "@/config/themedArt";
import { Physics } from "@/config/PhysicsConfig";
import { Enemy } from "./Enemy";

/** Pause between hops (ms), randomised per hop so groups don't sync up. */
const HOP_DELAY_MIN = 900;
const HOP_DELAY_MAX = 1700;
/** Hop impulse. */
const HOP_VX = 95;
const HOP_VY = -300;
/** How close (px) the player must be before the frog starts hopping at all. */
const WAKE_RANGE = 420;

/** Display scale of the 35x32 SunnyLand frog (16px-world art in a 32px world). */
const FROG_SCALE = 1.4;
const FROG_BODY_W = 22;
const FROG_BODY_H = 22;

/**
 * Frog (Tropic Lagoon): sits croaking, then hops toward the player in an arc —
 * a vertical threat the walkers don't pose, since a hop can crest low
 * platforms and cut off jump paths. Grounded it idles; airborne it shows the
 * strip's jump/fall poses. Stompable, like all critters.
 */
export class Frog extends Enemy {
  public readonly stompable = true;
  private nextHopAt = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly player: Phaser.GameObjects.Components.Transform
  ) {
    super(scene, x, y, TextureKeys.Frog);
    this.setScale(FROG_SCALE);
    this.body.setSize(FROG_BODY_W, FROG_BODY_H);
    this.body.setOffset(
      (this.width - FROG_BODY_W) / 2,
      this.height - FROG_BODY_H
    );
    this.play(EnemyAnim.frogIdle);
    this.setGravityY(Physics.GRAVITY_Y);
    this.scheduleHop(scene.time.now);
  }

  private scheduleHop(now: number): void {
    this.nextHopAt =
      now + Phaser.Math.Between(HOP_DELAY_MIN, HOP_DELAY_MAX);
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (this.dying) return;

    if (this.body.blocked.down) {
      // Landed: settle and idle until the next hop.
      this.setVelocityX(0);
      if (!this.anims.isPlaying) this.play(EnemyAnim.frogIdle);

      const dx = this.player.x - this.x;
      if (time >= this.nextHopAt) {
        if (Math.abs(dx) <= WAKE_RANGE) {
          const dir = dx < 0 ? -1 : 1;
          this.setFlipX(dir === 1); // art faces left
          this.setVelocity(HOP_VX * dir, HOP_VY);
        }
        this.scheduleHop(time);
      }
    } else {
      // Airborne: swap to the jump / fall pose frames.
      this.anims.stop();
      this.setFrame(this.body.velocity.y < 0 ? FROG_FRAME.jump : FROG_FRAME.fall);
    }
  }
}
