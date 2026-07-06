import Phaser from "phaser";
import { Physics } from "@/config/PhysicsConfig";
import { Enemy } from "./Enemy";

/** Tuning for a ground-walking enemy (see ShadowSoldier / LavaGolem). */
export interface WalkerConfig {
  /** Texture key (sprite strip or single image). */
  texture: string;
  /** Optional looping animation to play. */
  anim?: string;
  /** Cruise speed (px/s). */
  speed: number;
  /** Display scale of the source art. */
  scale: number;
  /** Physics body size in *source* px (bottom-anchored inside the art). */
  bodyW: number;
  bodyH: number;
  /** Art's default facing (true = faces right). Flipped to match travel. */
  facesRight?: boolean;
  /** Cosmetic side-to-side tilt while walking, in degrees (0 = none). */
  waddleDeg?: number;
  /** Tilt frequency (rad/s). */
  waddleFreq?: number;
  /** Pulsing aura colour (WebGL preFX glow); omit for no aura. */
  glowColor?: number;
  /** Base glow strength (pulses up to ~2.2×). */
  glowStrength?: number;
}

/**
 * A Goomba-style ground walker generalised from Plodder: paces left/right,
 * reverses at walls, and turns at ledges instead of marching off them. Adds two
 * "bring it to life" touches the classic Plodder doesn't need: an optional
 * side-to-side waddle (heavy enemies) and a pulsing glow aura (arcane/cursed
 * enemies). Concrete enemies just supply a WalkerConfig.
 */
export abstract class WalkerEnemy extends Enemy {
  public readonly stompable = true;
  private direction: 1 | -1 = -1;
  private waddlePhase = Math.random() * Math.PI * 2;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly terrain: Phaser.Tilemaps.TilemapLayer,
    private readonly cfg: WalkerConfig
  ) {
    super(scene, x, y, cfg.texture);
    this.setScale(cfg.scale);
    this.body.setSize(cfg.bodyW, cfg.bodyH);
    this.body.setOffset(
      (this.width - cfg.bodyW) / 2,
      this.height - cfg.bodyH
    );
    if (cfg.anim) this.play(cfg.anim);
    this.setGravityY(Physics.GRAVITY_Y);
    this.setVelocityX(cfg.speed * this.direction);
    this.addAura();
  }

  /** A soft, slowly-pulsing glow around the sprite (WebGL only; else skipped). */
  private addAura(): void {
    if (this.cfg.glowColor === undefined || !this.preFX) return;
    const base = this.cfg.glowStrength ?? 2;
    const glow = this.preFX.addGlow(this.cfg.glowColor, base, 0, false, 0.1, 12);
    this.scene.tweens.add({
      targets: glow,
      outerStrength: base * 2.2,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (this.dying) return;

    if (this.body.blocked.left) this.direction = 1;
    else if (this.body.blocked.right) this.direction = -1;

    if (this.body.blocked.down && this.isLedgeAhead()) {
      this.direction = this.direction === 1 ? -1 : 1;
    }

    this.setVelocityX(this.cfg.speed * this.direction);

    const facesRight = this.cfg.facesRight ?? true;
    this.setFlipX(facesRight ? this.direction === -1 : this.direction === 1);

    if (this.cfg.waddleDeg) {
      this.waddlePhase += (delta / 1000) * (this.cfg.waddleFreq ?? 6);
      // Arcade bodies stay axis-aligned, so this tilt is purely cosmetic.
      this.setAngle(Math.sin(this.waddlePhase) * this.cfg.waddleDeg);
    }
  }

  /** Probe a point just past the leading foot, one step down, for solid ground. */
  private isLedgeAhead(): boolean {
    const aheadX = this.x + this.direction * (this.body.halfWidth + 4);
    const belowY = this.body.bottom + 6;
    const tile = this.terrain.getTileAtWorldXY(aheadX, belowY);
    return !tile || !tile.collides;
  }
}
