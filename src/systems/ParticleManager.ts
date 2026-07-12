import Phaser from "phaser";
import { TextureKeys } from "@/config/AssetKeys";

/** Depth for all one-shot effects — above gameplay, below the HUD. */
const FX_DEPTH = 50;

/**
 * Pre-built particle emitters for one-shot bursts (coin sparkle, brick shatter,
 * stomp dust, power-up shimmer). Emitters are created once with emitting off and
 * triggered via `explode`, which is cheap and avoids per-effect allocation.
 */
export class ParticleManager {
  private readonly spark: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly crumb: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly puff: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly ring: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly shadow: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly droplet: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly bubble: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene) {
    this.spark = scene.add
      .particles(0, 0, TextureKeys.Spark, {
        speed: { min: 60, max: 170 },
        scale: { start: 1.1, end: 0 },
        lifespan: 450,
        gravityY: 280,
        tint: [0xffe08a, 0xffffff, 0xffc24e],
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(FX_DEPTH);

    this.crumb = scene.add
      .particles(0, 0, TextureKeys.Crumb, {
        speed: { min: 90, max: 210 },
        angle: { min: -115, max: -65 },
        scale: { start: 1, end: 0.4 },
        rotate: { start: 0, end: 360 },
        lifespan: 650,
        gravityY: 760,
        emitting: false,
      })
      .setDepth(FX_DEPTH);

    this.puff = scene.add
      .particles(0, 0, TextureKeys.Puff, {
        speed: { min: 20, max: 80 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 0.7, end: 0 },
        lifespan: 360,
        tint: 0xffffff,
        emitting: false,
      })
      .setDepth(FX_DEPTH);

    // Clean radial burst for the double jump (no gravity -> a tidy ring).
    this.ring = scene.add
      .particles(0, 0, TextureKeys.Spark, {
        speed: { min: 130, max: 210 },
        scale: { start: 1.1, end: 0 },
        lifespan: 360,
        gravityY: 0,
        tint: [0x6ad7ff, 0xffffff],
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(FX_DEPTH);

    // Dark violet wisps for the shadow dash (Jin-Woo) and shadow kills.
    this.shadow = scene.add
      .particles(0, 0, TextureKeys.Spark, {
        speed: { min: 80, max: 220 },
        scale: { start: 1.2, end: 0 },
        lifespan: 420,
        gravityY: -40,
        tint: [0x8a5cff, 0x4b2a99, 0xc9b6ff],
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(FX_DEPTH);

    // Water droplets kicked up by splashes (heavy, fall back down).
    this.droplet = scene.add
      .particles(0, 0, TextureKeys.Spark, {
        speedY: { min: -320, max: -120 },
        speedX: { min: -130, max: 130 },
        scale: { start: 0.9, end: 0 },
        lifespan: 520,
        gravityY: 900,
        tint: [0x9be4ff, 0xdffaff, 0x5fc8e8],
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(FX_DEPTH);

    // Small air bubbles drifting up while swimming underwater.
    this.bubble = scene.add
      .particles(0, 0, TextureKeys.Spark, {
        speedY: { min: -70, max: -30 },
        speedX: { min: -14, max: 14 },
        scale: { start: 0.4, end: 0.1 },
        alpha: { start: 0.8, end: 0 },
        lifespan: 900,
        tint: [0xdffaff, 0x9be4ff],
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(FX_DEPTH);
  }

  coinSparkle(x: number, y: number): void {
    this.spark.explode(8, x, y);
  }

  powerupSparkle(x: number, y: number): void {
    this.spark.explode(16, x, y);
  }

  brickShatter(x: number, y: number): void {
    this.crumb.explode(12, x, y);
  }

  stompPuff(x: number, y: number): void {
    this.puff.explode(10, x, y);
  }

  /** Small kick of dust at the feet on a ground jump. */
  jumpDust(x: number, y: number): void {
    this.puff.explode(6, x, y);
  }

  /** Radial spark ring for the mid-air double jump. */
  doubleJumpBurst(x: number, y: number): void {
    this.ring.explode(16, x, y);
    this.puff.explode(6, x, y);
  }

  /** Violet burst at the start of a shadow dash. */
  dashBurst(x: number, y: number): void {
    this.shadow.explode(18, x, y);
  }

  /** Shadow-blade kill: an enemy cut down mid-dash dissolves in violet wisps. */
  shadowKill(x: number, y: number): void {
    this.shadow.explode(24, x, y);
  }

  /** Water splash on entering/leaving a water zone (strength scales the burst). */
  splash(x: number, y: number, strength = 1): void {
    this.droplet.explode(Math.round(10 + 14 * Math.min(1, strength)), x, y);
  }

  /** A couple of bubbles from a swim stroke / underwater breathing. */
  bubbles(x: number, y: number, count = 3): void {
    this.bubble.explode(count, x, y);
  }

  /** Grip dust while wall-sliding. */
  wallDust(x: number, y: number): void {
    this.puff.explode(3, x, y);
  }
}
