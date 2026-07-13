import Phaser from "phaser";
import { TextureKeys, EnemyAnim } from "@/config/AssetKeys";

/** Timing of one tentacle strike (ms). */
const RISE_MS = 240;
const SINK_MS = 300;

/**
 * The Kraken's rising-tentacle hazard: a warning sparkle marks the spot, then
 * the tentacle shoots out of the ground, holds, and sinks back. It damages
 * only while it is actually out (`damaging`) — the warning is the dodge
 * window. Cleans itself up completely.
 */
export class Tentacle extends Phaser.Physics.Arcade.Sprite {
  public declare body: Phaser.Physics.Arcade.Body;
  private isOut = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    groundY: number,
    opts: { warnMs: number; holdMs: number; scale?: number }
  ) {
    super(scene, x, groundY, TextureKeys.Tentacle, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const s = opts.scale ?? 0.62;

    this.setOrigin(0.5, 1); // rooted in the ground
    this.setScale(s, 0.001); // hidden until the strike
    this.body.setAllowGravity(false);
    this.setImmovable(true);
    // A slimmer body than the art so grazing the outline feels fair.
    this.body.setSize(this.width * 0.5, this.height * 0.94);
    this.body.setOffset(this.width * 0.25, this.height * 0.06);

    // Warning: a burst of sparkles boiling out of the ground on the spot.
    const warn = scene.add
      .particles(x, groundY - 2, TextureKeys.Spark, {
        lifespan: 500,
        speedY: { min: -60, max: -20 },
        speedX: { min: -18, max: 18 },
        scale: { start: 0.4, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: [0xee96a0, 0x8c5cb2],
        blendMode: Phaser.BlendModes.ADD,
        frequency: 40,
        quantity: 1,
      })
      .setDepth(this.depth + 1);

    scene.time.delayedCall(opts.warnMs, () => {
      warn.destroy();
      if (!this.active) return;
      this.isOut = true;
      this.play(EnemyAnim.tentacleWave);
      scene.tweens.add({
        targets: this,
        scaleY: s,
        duration: RISE_MS,
        ease: "Back.out",
      });
      scene.time.delayedCall(RISE_MS + opts.holdMs, () => {
        if (!this.active) return;
        this.isOut = false;
        scene.tweens.add({
          targets: this,
          scaleY: 0.001,
          duration: SINK_MS,
          ease: "Quad.in",
          onComplete: () => this.destroy(),
        });
      });
    });
    // If the scene dies mid-warning the emitter must not linger.
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      if (warn.active) warn.destroy();
    });
  }

  /** True while the tentacle is out and can hurt the player. */
  get damaging(): boolean {
    return this.isOut && this.active;
  }
}
