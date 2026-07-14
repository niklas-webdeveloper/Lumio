import Phaser from "phaser";
import { Enemy } from "../Enemy";

/**
 * Scene events emitted by bosses. GameScene listens and owns everything that
 * touches the wider game (HUD hp bar, minion spawns, FX, victory flow) — the
 * boss entities stay self-contained state machines.
 */
export const BossEvents = {
  /** (hpFrac: number) — after every hit; drives the HUD boss bar. */
  Hp: "boss-hp",
  /** (x: number, y: number) — a hit connected (impact FX + sound). */
  Hurt: "boss-hurt",
  /** (x: number, y: number) — hp reached 0; start the victory flow. */
  Defeated: "boss-defeated",
  /** (x: number, y: number) — the Monarch calls a minion at this spot. */
  Summon: "boss-summon",
  /** (phase: 2) — the enrage threshold was crossed. */
  Phase: "boss-phase",
} as const;

/** Cooldown between ability/item hits, so multi-hit bursts (fire volley,
 *  star contact) don't melt the health bar in one go. */
const STRIKE_IFRAMES_MS = 700;

/**
 * Base for arena bosses: multi-hit health with two damage paths — STRIKES
 * (abilities, items, and armored stomps) connect any time but are gated by
 * short i-frames, while `hurt` (stomps in the explicit VULNERABLE window)
 * bypasses the i-frames so the punish window pays out fast. Enrage at half
 * health, defeat dissolve at 0. Extends Enemy for the shared physics/aura
 * plumbing but is deliberately kept OUT of GameScene's `enemies` group —
 * bosses have their own damage rules (no one-hit stomps, etc.).
 */
export abstract class Boss extends Enemy {
  /** Never stomp-killed like a regular enemy (scene bypasses group logic). */
  public readonly stompable = false;

  public readonly maxHp: number;
  protected hp: number;
  protected phase: 1 | 2 = 1;
  protected vulnerableFlag = false;
  /** Ability/item hits are ignored until this timestamp (strike i-frames). */
  private iframesUntil = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    maxHp: number
  ) {
    super(scene, x, y, texture);
    this.maxHp = maxHp;
    this.hp = maxHp;
  }

  public get hpFrac(): number {
    return Math.max(0, this.hp / this.maxHp);
  }

  /** True while the boss can actually be damaged (the punish window). */
  public get isVulnerable(): boolean {
    return this.vulnerableFlag && !this.dying;
  }

  public get isEnraged(): boolean {
    return this.phase === 2;
  }

  /** Contact hurts the player only while the boss is active (not stunned). */
  public override canDamage(): boolean {
    return !this.dying && !this.vulnerableFlag;
  }

  /**
   * A plain stomp hit: only connects during the vulnerable window — returns
   * false otherwise (the scene plays an armored "clank" instead). Ignores the
   * strike i-frames, so the punish window always pays out.
   */
  public hurt(): boolean {
    if (!this.active || !this.scene || this.dying || !this.vulnerableFlag) return false;
    this.applyDamage(1);
    return true;
  }

  /**
   * An ability/item hit (shadow dash, Divergent Fist, fireball, star touch):
   * connects ANY time the boss is on the field — the special moves are the
   * way to chip him down between windows. Gated by short i-frames so bursts
   * count as one hit, and by `hittable()` (e.g. not mid-teleport).
   */
  public strike(amount = 1): boolean {
    if (!this.active || !this.scene || this.dying || !this.hittable()) return false;
    const now = this.scene.time.now;
    if (now < this.iframesUntil) return false;
    this.iframesUntil = now + STRIKE_IFRAMES_MS;
    this.applyDamage(amount);
    return true;
  }

  /** Whether an ability strike can currently land (override: teleporting…). */
  protected hittable(): boolean {
    return true;
  }

  /** Take damage: HUD/FX events, flash, enrage crossing, defeat at 0. */
  private applyDamage(amount: number): void {
    this.hp -= amount;
    this.scene.events.emit(BossEvents.Hp, this.hpFrac);
    this.scene.events.emit(
      BossEvents.Hurt,
      this.x,
      this.y - this.displayHeight * 0.6
    );
    // White damage flash.
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(90, () => {
      if (this.active && !this.dying) this.applyIdleTint();
    });
    if (this.hp <= 0) {
      this.defeat();
      return;
    }
    if (this.phase === 1 && this.hp <= this.maxHp / 2) {
      this.phase = 2;
      this.scene.events.emit(BossEvents.Phase, 2);
      this.onEnrage();
    }
  }

  /** Restore the current state's resting tint after a damage flash. */
  protected applyIdleTint(): void {
    if (this.vulnerableFlag) this.setTint(0x9aa0c8); // dimmed while stunned
    else this.clearTint();
  }

  /** The defeat dissolve; the scene owns the victory flow via Defeated. */
  protected defeat(): void {
    if (this.dying) return;
    this.dying = true;
    this.vulnerableFlag = false;
    this.setVelocity(0, 0);
    this.body.enable = false;
    this.anims.stop();
    this.scene.events.emit(
      BossEvents.Defeated,
      this.x,
      this.y - this.displayHeight / 2
    );
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: this.scaleX * 1.18,
      scaleY: this.scaleY * 0.85,
      angle: 6,
      duration: 950,
      ease: "Quad.in",
      onComplete: () => this.destroy(),
    });
  }

  /** Phase 2 kicked in — speed the patterns up, flare the visuals. */
  protected abstract onEnrage(): void;
}
