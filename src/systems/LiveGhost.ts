import Phaser from "phaser";
import { CHARACTERS, type CharacterId } from "@/config/characterAssets";
import type { DuelFrame } from "@/systems/DuelClient";

/**
 * A respawn teleports the opponent across the level in one frame; gliding
 * there would look like flying. Jumps longer than this snap instead.
 */
const SNAP_DISTANCE_PX = 220;

/** Seconds the playback runs behind the newest received frame — enough to
 *  always have a segment to interpolate across (frames arrive every 80ms)
 *  plus headroom for internet jitter. */
const INTERP_DELAY_SEC = 0.2;

/** Playhead-vs-target gap that forces a hard resync (lag spike, tab was
 *  hidden) instead of rubber-banding across it. */
const RESYNC_GAP_SEC = 0.6;

/**
 * The opponent in an online duel, drawn as a warm-tinted translucent ghost
 * (the cool blue is the best-run replay's color). Purely visual — no physics
 * body, no collisions. Unlike GhostPlayer it has no finished recording: it
 * interpolates over the live rolling buffer of relayed frames, so it renders
 * a beat behind the newest frame and rides out network jitter.
 */
export class LiveGhost {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly label: Phaser.GameObjects.Text;
  private readonly anims: { idle: string; run: string; jump: string; fall: string };
  private done = false;
  /** Local playback clock on the opponent's frame timeline (see update). */
  private playhead = -1;
  /** How long playback has been starved at the buffer edge (seconds). */
  private stalledSec = 0;

  constructor(
    scene: Phaser.Scene,
    char: CharacterId,
    name: string,
    x: number,
    y: number,
    depth: number
  ) {
    const c = CHARACTERS[char];
    this.anims = {
      idle: c.anims.idle,
      run: c.anims.run,
      jump: c.anims.jump,
      fall: c.anims.fall,
    };
    this.sprite = scene.add
      .sprite(x, y, c.sheets.idle.key, 0)
      .setScale(0.5) // ghosts always render at the small-state scale
      .setAlpha(0.5)
      .setTint(0xffb44d)
      .setDepth(depth);
    this.sprite.anims.play(this.anims.idle);

    // Name tag riding above the ghost (resolution counters the camera zoom).
    this.label = scene.add
      .text(x, y - 26, name, {
        fontFamily: '"Baloo 2", "Trebuchet MS", sans-serif',
        fontSize: "9px",
        fontStyle: "bold",
        color: "#ffd95e",
        stroke: "#1a2430",
        strokeThickness: 3,
        resolution: 6,
      })
      .setOrigin(0.5, 1)
      .setAlpha(0.9)
      .setDepth(depth);
  }

  /**
   * Advance playback by one frame. The playback clock lives entirely on the
   * opponent's frame timeline: it follows `newest frame - INTERP_DELAY` by
   * gently rubber-banding toward it. Comparing the two players' race clocks
   * (they start at each side's own GO and are never synchronized) would pin
   * the playhead to the buffer edge — position still tracks, but every
   * segment collapses to a point, so the pose inference reads "standing"
   * and the ghost slides around without a run animation.
   */
  update(frames: readonly DuelFrame[], deltaSec: number): void {
    // The scene teardown after a finish can destroy the sprite while one last
    // scene update is still in flight — a destroyed sprite has no anims.
    if (this.done || !this.sprite.anims || frames.length === 0) return;

    const first = frames[0];
    const latest = frames[frames.length - 1];
    const target = latest.t - INTERP_DELAY_SEC;
    if (this.playhead < 0 || Math.abs(target - this.playhead) > RESYNC_GAP_SEC) {
      this.playhead = target; // first frame, lag spike or hidden tab: resync
    } else {
      // Run at ~1×, slightly faster/slower to close the drift — smooth
      // motion between packets without draining or overfilling the buffer.
      const drift = target - this.playhead;
      this.playhead += deltaSec * Phaser.Math.Clamp(1 + drift, 0.5, 1.5);
    }
    const t = Phaser.Math.Clamp(this.playhead, first.t, latest.t);

    // Find the segment containing t (buffer is short, scan from the end).
    let a = first;
    let b = first;
    for (let i = frames.length - 1; i >= 0; i--) {
      if (frames[i].t <= t) {
        a = frames[i];
        b = frames[Math.min(i + 1, frames.length - 1)];
        break;
      }
    }

    const span = Math.max(0.0001, b.t - a.t);
    const k = Phaser.Math.Clamp((t - a.t) / span, 0, 1);
    // Death respawn: the opponent teleported — snap, don't glide.
    const teleport = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y) > SNAP_DISTANCE_PX;
    const x = teleport ? b.x : Phaser.Math.Linear(a.x, b.x, k);
    const y = teleport ? b.y : Phaser.Math.Linear(a.y, b.y, k);
    this.sprite.setPosition(x, y);
    this.sprite.setFlipX(b.f === 1);
    this.label.setPosition(x, y - 26);

    // Infer the pose from the sampled motion (same rule as the replay ghost).
    // At the buffer edge (a === b) there is no motion to read: a brief packet
    // gap keeps the current pose, but a drained buffer (the opponent is dead,
    // respawning or paused — no frames flowing) settles into idle instead of
    // freezing mid-run-cycle.
    if (a === b || teleport) {
      this.stalledSec += deltaSec;
      if (
        this.stalledSec > 0.3 &&
        this.sprite.anims.currentAnim?.key !== this.anims.idle
      ) {
        this.sprite.anims.play(this.anims.idle, true);
      }
      return;
    }
    this.stalledSec = 0;
    const vx = (b.x - a.x) / span;
    const vy = (b.y - a.y) / span;
    const key =
      vy < -60 ? this.anims.jump : vy > 90 ? this.anims.fall : Math.abs(vx) > 25 ? this.anims.run : this.anims.idle;
    if (this.sprite.anims.currentAnim?.key !== key) this.sprite.anims.play(key, true);
  }

  /** The opponent crossed the finish line — fade the ghost out where it is. */
  finishAndFade(): void {
    if (this.done) return;
    this.done = true;
    this.sprite.scene.tweens.add({
      targets: [this.sprite, this.label],
      alpha: 0,
      duration: 600,
      onComplete: () => {
        this.sprite.destroy();
        this.label.destroy();
      },
    });
  }
}
