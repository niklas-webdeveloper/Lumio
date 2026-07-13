import Phaser from "phaser";
import { TextureKeys, EnemyAnim } from "@/config/AssetKeys";
import { KRAKEN_FRAME } from "@/config/bossArt";
import { audioManager } from "@/systems/AudioManager";
import { attachAura } from "../aura";
import { Boss } from "./Boss";
import { BossOrb } from "./BossOrb";
import { Tentacle } from "./Tentacle";

/** Everything the Kraken needs from the scene. */
export interface KrakenConfig {
  player: Phaser.GameObjects.Components.Transform;
  /** Group the ink lobs are spawned into (scene wires the overlaps). */
  orbs: Phaser.GameObjects.Group;
  /** Group the tentacle hazards are spawned into. */
  zones: Phaser.GameObjects.Group;
  /** Ground line under a world x (tentacles root on it). */
  groundYAt: (x: number) => number;
  /** The pool's left/right edge and the shore-top line (lunge targets). */
  poolLeft: number;
  poolRight: number;
  shoreTopY: number;
}

type KrakenState =
  | "intro"
  | "volley"
  | "tentacles"
  | "lunge"
  | "stunned"
  | "retreat";

const HP = 6;
/** Ballistic flight time of an ink lob (s) and its projectile gravity. */
const LOB_T = 1.05;
const LOB_GRAVITY = 900;
/** Pattern tuning per phase (phase 2 = enraged at half health). Paced so the
 *  player never feels cornered: unhurried lobs, long tentacle warnings with
 *  wide gaps between the strike spots, and generous punish windows. */
const TUNING = {
  1: { lobs: 3, lobGapMs: 850, tentacles: 2, warnMs: 950, stunMs: 4600 },
  2: { lobs: 4, lobGapMs: 620, tentacles: 3, warnMs: 780, stunMs: 3900 },
} as const;

/**
 * The KRAKEN (level-09 "Krakenbucht"). It lurks bobbing in the pool between
 * the two shores. Pattern loop:
 *   volley    — ballistic ink lobs rain onto the player's position
 *   tentacles — marked spots on the ground erupt into tentacle columns
 *   lunge     — it surges onto the shore edge near the player…
 *   stunned   — …and lies beached: the VULNERABLE window (stomp the head!)
 *   retreat   — slides back into the pool
 * At half health it enrages: more lobs, more tentacles, shorter windows.
 */
export class KrakenBoss extends Boss {
  private fightState: KrakenState = "intro";
  private stateT = 1600;
  private lobsLeft = 0;
  private lobT = 0;
  private readonly homeX: number;
  private readonly homeY: number;
  private bobT = 0;
  /** True while a movement tween owns x/y (lunge/retreat). */
  private moving = false;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly cfg: KrakenConfig) {
    super(scene, x, y, TextureKeys.BossKraken, HP);
    this.homeX = x;
    this.homeY = y;
    this.play(EnemyAnim.krakenIdle);
    this.body.setAllowGravity(false);
    this.setImmovable(true);
    // Only the dome hurts/is stompable — the art's tentacle skirt stays soft.
    this.body.setSize(112, 104);
    this.body.setOffset((this.width - 112) / 2, 10);
    attachAura(this, { color: 0x2ec4a9, alpha: 0.3, pulseMs: 1100 });
    audioManager.play("bossroar");
  }

  private get tuning() {
    return TUNING[this.phase];
  }

  protected onEnrage(): void {
    audioManager.play("bossroar");
    this.scene.cameras.main.flash(160, 20, 90, 80);
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (this.dying) return;

    this.stateT -= delta;
    // Lazy idle bob while it sits in the pool (tweens own x/y otherwise).
    if (!this.moving && this.fightState !== "stunned") {
      this.bobT += delta;
      this.y = this.homeY + Math.sin(this.bobT / 600) * 5;
    }

    switch (this.fightState) {
      case "intro":
        if (this.stateT <= 0) this.enter("volley");
        break;

      case "volley": {
        this.lobT -= delta;
        if (this.lobsLeft > 0 && this.lobT <= 0) {
          this.lobInk();
          this.lobsLeft -= 1;
          this.lobT = this.tuning.lobGapMs;
        }
        if (this.lobsLeft <= 0 && this.stateT <= 0) this.enter("tentacles");
        break;
      }

      case "tentacles":
        if (this.stateT <= 0) this.enter("lunge");
        break;

      case "lunge":
      case "retreat":
        break; // tween-driven; the tween's onComplete advances the state

      case "stunned":
        if (this.stateT <= 0) this.enter("retreat");
        break;
    }
  }

  private enter(next: KrakenState): void {
    if (this.dying) return;
    this.fightState = next;
    switch (next) {
      case "volley": {
        this.lobsLeft = this.tuning.lobs;
        this.lobT = 400;
        this.stateT = this.lobsLeft * this.tuning.lobGapMs + 900;
        this.play(EnemyAnim.krakenIdle);
        break;
      }
      case "tentacles": {
        const t = this.tuning;
        const px = this.cfg.player.x;
        // Never box the player in: one under them plus one far to a single
        // side — only the enrage phase strikes both sides, and always with
        // gaps wide enough to run through.
        const spots =
          t.tentacles >= 3
            ? [px, px - 170, px + 170]
            : [px, px + (Math.random() < 0.5 ? -170 : 170)];
        for (const x of spots) {
          const tentacle = new Tentacle(this.scene, x, this.cfg.groundYAt(x), {
            warnMs: t.warnMs,
            holdMs: 850,
          });
          tentacle.setDepth(this.depth - 0.5);
          this.cfg.zones.add(tentacle);
        }
        this.stateT = t.warnMs + 240 + 850 + 700;
        break;
      }
      case "lunge": {
        this.stateT = 5000; // safety ceiling; the tween advances the state
        this.moving = true;
        this.anims.stop();
        this.setFrame(KRAKEN_FRAME.attack);
        audioManager.play("splash");
        // Surge onto the shore edge on the player's side of the pool.
        const toLeft = this.cfg.player.x < this.homeX;
        const targetX = toLeft ? this.cfg.poolLeft - 4 : this.cfg.poolRight + 4;
        const targetY = this.cfg.shoreTopY + 40; // slumped over the lip
        this.scene.tweens.add({
          targets: this,
          x: targetX,
          y: targetY,
          duration: 650,
          ease: "Sine.in",
          onComplete: () => {
            this.scene.cameras.main.shake(160, 0.005);
            audioManager.play("stomp");
            this.moving = false;
            this.enter("stunned");
          },
        });
        break;
      }
      case "stunned": {
        this.stateT = this.tuning.stunMs;
        this.vulnerableFlag = true;
        this.anims.stop();
        this.setFrame(KRAKEN_FRAME.stun);
        this.applyIdleTint();
        break;
      }
      case "retreat": {
        this.stateT = 5000; // safety ceiling; the tween advances the state
        this.vulnerableFlag = false;
        this.applyIdleTint();
        this.play(EnemyAnim.krakenIdle);
        this.moving = true;
        audioManager.play("splash");
        this.scene.tweens.add({
          targets: this,
          x: this.homeX,
          y: this.homeY,
          duration: 620,
          ease: "Sine.inOut",
          onComplete: () => {
            this.moving = false;
            this.bobT = 0;
            this.enter("volley");
          },
        });
        break;
      }
      case "intro":
        break;
    }
  }

  /** One ballistic ink lob aimed to land on the player. */
  private lobInk(): void {
    const player = this.cfg.player;
    const sx = this.x;
    const sy = this.y - this.displayHeight * 0.75; // from the dome
    const vx = Phaser.Math.Clamp((player.x - sx) / LOB_T, -320, 320);
    const vy = (player.y - sy - 0.5 * LOB_GRAVITY * LOB_T * LOB_T) / LOB_T;
    const orb = new BossOrb(this.scene, sx, sy, TextureKeys.InkOrb, vx, vy, {
      gravityY: LOB_GRAVITY,
    });
    orb.setDepth(this.depth + 1);
    this.cfg.orbs.add(orb);
    // A quick "spit" pose sells the lob.
    this.anims.stop();
    this.setFrame(KRAKEN_FRAME.attack);
    this.scene.time.delayedCall(220, () => {
      if (this.active && !this.dying && this.fightState === "volley") {
        this.play(EnemyAnim.krakenIdle);
      }
    });
    audioManager.play("swim");
  }
}
