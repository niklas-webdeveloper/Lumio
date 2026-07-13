import Phaser from "phaser";
import { TextureKeys, EnemyAnim } from "@/config/AssetKeys";
import { MONARCH_FRAME } from "@/config/bossArt";
import { Physics } from "@/config/PhysicsConfig";
import { audioManager } from "@/systems/AudioManager";
import { attachAura } from "../aura";
import { Boss, BossEvents } from "./Boss";
import { BossOrb } from "./BossOrb";

/** Everything the Monarch needs from the scene. */
export interface MonarchConfig {
  player: Phaser.GameObjects.Components.Transform;
  /** Group the shadow bolts are spawned into (scene wires the overlaps). */
  orbs: Phaser.GameObjects.Group;
}

type MonarchState =
  | "intro"
  | "summon"
  | "volley"
  | "telegraph"
  | "dash"
  | "stunned"
  | "recover";

const HP = 6;
/** Pattern tuning per phase (phase 2 = enraged at half health). Paced so the
 *  player always has an answer: slow, readable bolts, a long dash telegraph
 *  and generous punish windows. */
const TUNING = {
  1: { bolts: 3, boltGapMs: 780, boltSpeed: 195, dashSpeed: 400, stunMs: 4600, telegraphMs: 1100 },
  2: { bolts: 4, boltGapMs: 560, boltSpeed: 230, dashSpeed: 470, stunMs: 3900, telegraphMs: 900 },
} as const;
/** Violet shades for the dash after-images (matches the shadow-army look). */
const DASH_SHADES = [0x9d5cff, 0x6a2fd8, 0x4b1f9e];

/**
 * The SHADOW MONARCH (level-08 "Monarchs Thron"). Pattern loop:
 *   summon    — teleports away from the player and calls shadow beasts
 *   volley    — aimed shadow bolts (dodge or block line-of-sight)
 *   telegraph — sword raised, body flashing: the dash is coming
 *   dash      — sweeps the arena floor at high speed
 *   stunned   — crashed into the wall: the VULNERABLE window (stomp him!)
 * At half health he enrages: more bolts, faster everything, shorter window.
 */
export class MonarchBoss extends Boss {
  private fightState: MonarchState = "intro";
  /** Countdown to the next state transition (ms). */
  private stateT = 1600;
  private boltsLeft = 0;
  private boltT = 0;
  private dashDir: 1 | -1 = -1;
  private trailT = 0;
  private teleporting = false;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly cfg: MonarchConfig) {
    super(scene, x, y, TextureKeys.BossMonarch, HP);
    this.setFrame(MONARCH_FRAME.idle);
    this.setGravityY(Physics.GRAVITY_Y);
    this.body.setSize(58, 100);
    this.body.setOffset((this.width - 58) / 2, this.height - 100);
    attachAura(this, { color: 0x8a5cff, alpha: 0.5, pulseMs: 800 });
    audioManager.play("bossroar");
  }

  private get tuning() {
    return TUNING[this.phase];
  }

  protected onEnrage(): void {
    audioManager.play("bossroar");
    this.scene.cameras.main.flash(160, 80, 20, 120);
  }

  /** Mid-teleport he is shadow — ability strikes pass through. */
  protected override hittable(): boolean {
    return !this.teleporting;
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (this.dying || this.teleporting) return;

    this.stateT -= delta;
    const player = this.cfg.player;
    // Face the player except mid-dash (art faces right unflipped).
    if (this.fightState !== "dash") this.setFlipX(player.x < this.x);

    switch (this.fightState) {
      case "intro":
        if (this.stateT <= 0) this.enter("summon");
        break;

      case "summon":
        if (this.stateT <= 0) this.enter("volley");
        break;

      case "volley": {
        this.boltT -= delta;
        if (this.boltsLeft > 0 && this.boltT <= 0) {
          this.fireBolt();
          this.boltsLeft -= 1;
          this.boltT = this.tuning.boltGapMs;
        }
        if (this.boltsLeft <= 0 && this.stateT <= 0) this.enter("telegraph");
        break;
      }

      case "telegraph":
        if (this.stateT <= 0) this.enter("dash");
        break;

      case "dash": {
        this.setVelocityX(this.tuning.dashSpeed * this.dashDir);
        this.trailT -= delta;
        if (this.trailT <= 0) {
          this.spawnAfterImage();
          this.trailT = 45;
        }
        const hitWall =
          (this.dashDir === -1 && this.body.blocked.left) ||
          (this.dashDir === 1 && this.body.blocked.right);
        if (hitWall || this.stateT <= 0) {
          this.setVelocityX(0);
          this.scene.cameras.main.shake(180, 0.006);
          audioManager.play("stomp");
          this.enter("stunned");
        }
        break;
      }

      case "stunned":
        if (this.stateT <= 0) this.enter("recover");
        break;

      case "recover":
        if (this.stateT <= 0) this.enter("summon");
        break;
    }
  }

  /** Switch state and set up its visuals/timers. */
  private enter(next: MonarchState): void {
    this.fightState = next;
    switch (next) {
      case "summon": {
        this.stateT = 1000;
        this.teleportAwayAndSummon();
        break;
      }
      case "volley": {
        this.boltsLeft = this.tuning.bolts;
        this.boltT = 350;
        // Generous ceiling; the state really ends when the bolts are out.
        this.stateT = this.boltsLeft * this.tuning.boltGapMs + 900;
        this.play(EnemyAnim.monarchBrandish);
        break;
      }
      case "telegraph": {
        this.stateT = this.tuning.telegraphMs;
        this.anims.stop();
        this.setFrame(MONARCH_FRAME.swordRaised);
        audioManager.play("bossroar");
        // Flicker = "get out of the lane".
        this.scene.tweens.add({
          targets: this,
          alpha: { from: 1, to: 0.55 },
          duration: 140,
          yoyo: true,
          repeat: 2,
        });
        break;
      }
      case "dash": {
        this.stateT = 3200; // safety ceiling; normally ends at the wall
        this.dashDir = this.cfg.player.x < this.x ? -1 : 1;
        this.setFlipX(this.dashDir === -1);
        this.setFrame(MONARCH_FRAME.swordLow);
        audioManager.play("dash");
        break;
      }
      case "stunned": {
        this.stateT = this.tuning.stunMs;
        this.vulnerableFlag = true;
        this.anims.stop();
        this.setFrame(MONARCH_FRAME.idle);
        this.applyIdleTint();
        this.scene.tweens.add({ targets: this, angle: -7, duration: 220 });
        break;
      }
      case "recover": {
        this.stateT = 550;
        this.vulnerableFlag = false;
        this.applyIdleTint();
        this.scene.tweens.add({ targets: this, angle: 0, duration: 180 });
        break;
      }
      case "intro":
        break;
    }
  }

  /** Fade out, reappear a SHORT hop from the player, call the shadow beasts.
   *  Deliberately not across the map: chasing him down was a slog — he stays
   *  engaged, just far enough to read his next pattern. */
  private teleportAwayAndSummon(): void {
    const bounds = this.scene.physics.world.bounds;
    const left = bounds.left + 130;
    const right = bounds.right - 130;
    const px = this.cfg.player.x;
    // Reappear ~260px to the player's roomier side, clamped into the arena.
    const dir = px < (left + right) / 2 ? 1 : -1;
    const targetX = Phaser.Math.Clamp(px + dir * 260, left, right);

    this.teleporting = true;
    this.setVelocity(0, 0);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 170,
      onComplete: () => {
        if (!this.active || this.dying) return;
        this.setX(targetX);
        this.scene.tweens.add({
          targets: this,
          alpha: 1,
          duration: 170,
          onComplete: () => {
            this.teleporting = false;
            if (this.dying) return;
            const count = this.phase === 2 ? 2 : 1;
            for (let i = 0; i < count; i++) {
              this.scene.events.emit(
                BossEvents.Summon,
                this.x - this.dashDirTo(this.cfg.player.x) * (70 + i * 46),
                this.y
              );
            }
          },
        });
      },
    });
  }

  private dashDirTo(x: number): 1 | -1 {
    return x < this.x ? -1 : 1;
  }

  /** One aimed shadow bolt from the sword hand. */
  private fireBolt(): void {
    const dir = this.flipX ? -1 : 1;
    const sx = this.x + dir * 44;
    const sy = this.y - this.displayHeight * 0.62;
    const player = this.cfg.player;
    const aim = new Phaser.Math.Vector2(player.x - sx, player.y - 14 - sy)
      .normalize()
      .scale(this.tuning.boltSpeed);
    const orb = new BossOrb(this.scene, sx, sy, TextureKeys.ShadowOrb, aim.x, aim.y, {
      additive: true,
    });
    orb.setDepth(this.depth + 1);
    this.cfg.orbs.add(orb);
    audioManager.play("doublejump");
  }

  /** A fading violet silhouette along the dash path (shadow-army look). */
  private spawnAfterImage(): void {
    const shade = DASH_SHADES[Math.floor(Math.random() * DASH_SHADES.length)];
    const img = this.scene.add
      .image(this.x, this.y, this.texture.key, this.frame.name)
      .setOrigin(this.originX, this.originY)
      .setFlipX(this.flipX)
      .setScale(this.scaleX, this.scaleY)
      .setTintFill(shade)
      .setAlpha(0.7)
      .setDepth(this.depth - 0.2);
    this.scene.tweens.add({
      targets: img,
      alpha: 0,
      duration: 300,
      ease: "Quad.out",
      onComplete: () => img.destroy(),
    });
  }
}
