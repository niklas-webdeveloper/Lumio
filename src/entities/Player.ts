import Phaser from "phaser";
import { Physics, PlayerSize } from "@/config/PhysicsConfig";
import { PlayerArt } from "@/config/AssetKeys";
import type { InputState } from "@/systems/InputManager";
import { audioManager } from "@/systems/AudioManager";

/** Move a value toward a target by at most `maxDelta` (framerate-independent). */
function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return target;
}

/** Player power level. */
export type PlayerSizeState = "small" | "big";

/** Outcome of a damage event, so the scene can react (sfx, lives, …). */
export type DamageResult = "invulnerable" | "shrank" | "died";

/** How long the player blinks and ignores damage after getting hit (ms). */
const INVULN_DURATION_MS = 1500;
/** Blink toggle interval during invulnerability (ms). */
const BLINK_INTERVAL_MS = 90;

/**
 * The player character (Lumio).
 *
 * Implements the full "game feel" spec:
 *  - acceleration/friction horizontal movement (walk vs run)
 *  - variable jump height (release-to-cut)
 *  - coyote time (jump shortly after leaving a ledge)
 *  - jump buffering (jump pressed just before landing)
 *  - asymmetric gravity (heavier falling than rising) + terminal velocity
 *
 * Movement is integrated manually for horizontal control; vertical motion uses
 * Arcade gravity (set per-frame) so collisions resolve naturally.
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  public declare body: Phaser.Physics.Arcade.Body;

  /** 1 = facing right, -1 = facing left. */
  private facing: 1 | -1 = 1;

  /** Time (ms) the player may still jump after leaving the ground. */
  private coyoteTimer = 0;
  /** Time (ms) remaining on a buffered jump request. */
  private jumpBufferTimer = 0;
  /** True while in an upward jump arc we are allowed to cut short. */
  private isJumpRising = false;
  /** Jumps performed since last touching the ground (0..MAX_JUMPS). */
  private jumpsUsed = 0;
  /** Active flip tween for the double jump (so we can cancel/reset it). */
  private spinTween?: Phaser.Tweens.Tween;

  /** Power level. Affects size, brick-breaking, and damage handling. */
  private size: PlayerSizeState = "small";
  /** Remaining invulnerability time (ms); >0 means hits are ignored. */
  private invulnTimer = 0;
  /** Accumulator driving the blink while invulnerable. */
  private blinkAccumulator = 0;
  /** Set once the player has died; control is suspended. */
  private dead = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, PlayerArt.tex.small.idle);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(0.5, 0.5);
    this.setCollideWorldBounds(true);
    this.applyBodyForSize();
    // Terminal velocity cap (vertical). Horizontal is bounded by RUN_SPEED via
    // the manual integration below.
    this.body.setMaxVelocity(Physics.RUN_SPEED, Physics.MAX_FALL_SPEED);
  }

  /** Whether the player is currently standing on something. */
  private get onGround(): boolean {
    return this.body.blocked.down || this.body.touching.down;
  }

  /**
   * Advance the player one frame.
   * @param deltaMs frame delta in milliseconds (from Scene.update)
   * @param input   this frame's input snapshot
   */
  public updatePlayer(deltaMs: number, input: InputState): void {
    // While dead, the death "pop" plays out under gravity with no control.
    if (this.dead) return;

    const dt = deltaMs / 1000; // seconds for accel/velocity math
    const grounded = this.onGround;

    this.updateHorizontal(dt, grounded, input);
    this.updateTimers(deltaMs, grounded, input);
    this.updateJump(input);
    this.updateGravity();
    this.updateInvulnerability(deltaMs);
    this.updateAnimation(grounded);
  }

  /** Pick and play the right animation for the current motion + size. */
  private updateAnimation(grounded: boolean): void {
    const a = this.size === "big" ? PlayerArt.anim.big : PlayerArt.anim.small;
    if (!grounded) {
      this.anims.play(a.jump, true);
      this.anims.timeScale = 1;
    } else if (Math.abs(this.body.velocity.x) > 8) {
      this.anims.play(a.run, true);
      // Stride faster the quicker we move (walk -> sprint).
      this.anims.timeScale = Phaser.Math.Clamp(
        Math.abs(this.body.velocity.x) / Physics.WALK_SPEED,
        0.7,
        1.8
      );
    } else {
      this.anims.play(a.idle, true);
      this.anims.timeScale = 1;
    }
  }

  /** Count down invulnerability and blink the sprite while it's active. */
  private updateInvulnerability(deltaMs: number): void {
    if (this.invulnTimer <= 0) return;
    this.invulnTimer -= deltaMs;
    this.blinkAccumulator += deltaMs;
    if (this.blinkAccumulator >= BLINK_INTERVAL_MS) {
      this.blinkAccumulator = 0;
      this.setAlpha(this.alpha < 1 ? 1 : 0.3);
    }
    if (this.invulnTimer <= 0) {
      this.invulnTimer = 0;
      this.setAlpha(1);
    }
  }

  /** Acceleration / friction horizontal movement with crisp turn-arounds. */
  private updateHorizontal(dt: number, grounded: boolean, input: InputState): void {
    const targetSpeed =
      input.moveX * (input.run ? Physics.RUN_SPEED : Physics.WALK_SPEED);

    let rate: number;
    if (input.moveX !== 0) {
      rate = grounded ? Physics.GROUND_ACCEL : Physics.AIR_ACCEL;
      // Reversing direction? Apply a boost so turns feel snappy, not sluggish.
      const reversing =
        this.body.velocity.x !== 0 &&
        Math.sign(input.moveX) !== Math.sign(this.body.velocity.x);
      if (reversing) rate *= Physics.TURN_ACCEL_MULTIPLIER;

      this.facing = input.moveX > 0 ? 1 : -1;
      this.setFlipX(this.facing === -1);
    } else {
      // No input: decelerate toward a stop (slides a touch, never abrupt).
      rate = grounded ? Physics.GROUND_FRICTION : Physics.AIR_FRICTION;
    }

    const newVx = approach(this.body.velocity.x, targetSpeed, rate * dt);
    this.setVelocityX(newVx);
  }

  /** Tick coyote-time and jump-buffer windows. */
  private updateTimers(deltaMs: number, grounded: boolean, input: InputState): void {
    // Coyote: refilled while grounded, drains in the air.
    this.coyoteTimer = grounded
      ? Physics.COYOTE_TIME_MS
      : Math.max(0, this.coyoteTimer - deltaMs);

    // Buffer: a jump press is remembered briefly so it can fire on landing.
    this.jumpBufferTimer = input.jumpJustPressed
      ? Physics.JUMP_BUFFER_MS
      : Math.max(0, this.jumpBufferTimer - deltaMs);

    if (grounded && this.body.velocity.y >= 0) {
      // Landing: reset jump count, clear the cut flag, undo any flip spin.
      this.isJumpRising = false;
      this.jumpsUsed = 0;
      this.endSpin();
    } else if (this.jumpsUsed === 0 && this.coyoteTimer === 0) {
      // Walked off a ledge without jumping and coyote expired: forfeit the
      // grounded jump so only the air (recovery) jump remains.
      this.jumpsUsed = 1;
    }
  }

  /** Execute ground / double jumps and apply variable-height jump-cut. */
  private updateJump(input: InputState): void {
    const groundJumpReady =
      this.jumpsUsed === 0 && this.coyoteTimer > 0 && this.jumpBufferTimer > 0;

    if (groundJumpReady) {
      // First jump: from the ground or within the coyote window (buffered).
      this.startJump(Physics.JUMP_VELOCITY);
      this.jumpsUsed = 1;
      this.jumpBufferTimer = 0;
      this.coyoteTimer = 0;
      audioManager.play("jump");
      this.scene.events.emit("player-jump", this.x, this.body.bottom);
    } else if (
      input.jumpJustPressed &&
      !this.onGround &&
      this.jumpsUsed < Physics.MAX_JUMPS
    ) {
      // Mid-air double jump: a crisp upward reset + a flip + a burst.
      this.startJump(Physics.DOUBLE_JUMP_VELOCITY);
      this.jumpsUsed = Physics.MAX_JUMPS; // one air jump, regardless of prior state
      this.startSpin();
      audioManager.play("doublejump");
      this.scene.events.emit("player-doublejump", this.x, this.y);
    }

    // Variable jump height: releasing while still rising cuts upward velocity.
    if (input.jumpJustReleased && this.isJumpRising && this.body.velocity.y < 0) {
      this.setVelocityY(this.body.velocity.y * Physics.JUMP_CUT_MULTIPLIER);
      this.isJumpRising = false;
    }
  }

  /** Apply an upward jump impulse and re-arm the variable-height cut. */
  private startJump(velocity: number): void {
    this.setVelocityY(velocity);
    this.isJumpRising = true;
  }

  /** Smooth 360° flip for the double jump (direction follows facing). */
  private startSpin(): void {
    this.endSpin();
    this.setAngle(0);
    this.spinTween = this.scene.tweens.add({
      targets: this,
      angle: 360 * this.facing,
      duration: Physics.DOUBLE_JUMP_SPIN_MS,
      ease: "Cubic.out",
      onComplete: () => {
        this.setAngle(0);
        this.spinTween = undefined;
      },
    });
  }

  /** Cancel an in-progress flip and reset rotation (e.g. on landing). */
  private endSpin(): void {
    if (this.spinTween) {
      this.spinTween.stop();
      this.spinTween = undefined;
    }
    this.setAngle(0);
  }

  /** Heavier gravity while falling than rising for a weighty feel. */
  private updateGravity(): void {
    const g =
      this.body.velocity.y > 0
        ? Physics.GRAVITY_Y * Physics.FALL_GRAVITY_MULTIPLIER
        : Physics.GRAVITY_Y;
    this.setGravityY(g);
  }

  // ----- Power state & damage -----

  /** Resize the physics body to match the current size, keeping feet planted. */
  private applyBodyForSize(): void {
    const dim = this.size === "big" ? PlayerSize.BIG : PlayerSize.SMALL;
    this.body.setSize(dim.width, dim.height, true);
  }

  /** Grow from small to big (Growcap power-up). No-op if already big. */
  public grow(): void {
    if (this.dead || this.size === "big") return;
    const grew = PlayerSize.BIG.height - PlayerSize.SMALL.height;
    this.size = "big";
    this.setTexture(PlayerArt.tex.big.idle);
    this.applyBodyForSize();
    this.y -= grew; // shift up so the larger body doesn't clip into the floor
    // A quick squash-and-stretch pop for feedback.
    this.scene.tweens.add({
      targets: this,
      scaleX: { from: 1.25, to: 1 },
      scaleY: { from: 0.8, to: 1 },
      duration: 180,
      ease: "Back.out",
    });
  }

  /**
   * Apply damage from a hazard/enemy. Big -> small (with invulnerability);
   * small -> death. Ignored while invulnerable or dead.
   */
  public takeDamage(): DamageResult {
    if (this.dead) return "died";
    if (this.invulnTimer > 0) return "invulnerable";

    if (this.size === "big") {
      const shrank = PlayerSize.BIG.height - PlayerSize.SMALL.height;
      this.size = "small";
      this.setTexture(PlayerArt.tex.small.idle);
      this.applyBodyForSize();
      this.y += shrank;
      this.startInvulnerability();
      return "shrank";
    }

    this.die();
    return "died";
  }

  private startInvulnerability(): void {
    this.invulnTimer = INVULN_DURATION_MS;
    this.blinkAccumulator = 0;
    this.setAlpha(0.3);
  }

  /** Begin the death sequence: a small pop, collisions off, no control. */
  public die(): void {
    if (this.dead) return;
    this.dead = true;
    this.setAlpha(1);
    this.endSpin();
    this.anims.stop();
    this.setTexture(
      this.size === "big" ? PlayerArt.tex.big.jump : PlayerArt.tex.small.jump
    );
    this.setTint(0xff7a8a); // brief "hurt" flush
    this.body.setVelocity(0, -380); // hop up...
    this.setGravityY(Physics.GRAVITY_Y);
    this.body.checkCollision.none = true; // ...then fall through everything
  }

  /** Bounce the player upward (used after stomping an enemy in Milestone 5). */
  public bounce(velocity = Physics.STOMP_BOUNCE_VELOCITY): void {
    this.setVelocityY(velocity);
    this.isJumpRising = false;
  }

  /** Current facing direction (1 right, -1 left) — used by later animations. */
  public get facingDirection(): 1 | -1 {
    return this.facing;
  }

  /** Current power level. */
  public get sizeState(): PlayerSizeState {
    return this.size;
  }

  /** True when the player can break bricks and survive one hit. */
  public get isBig(): boolean {
    return this.size === "big";
  }

  /** True after death (scene uses this to trigger respawn / lose a life). */
  public get isDead(): boolean {
    return this.dead;
  }

  /** True while briefly invulnerable after taking damage. */
  public get isInvulnerable(): boolean {
    return this.invulnTimer > 0;
  }

  /** Jumps performed since last grounded (for tests/UI). */
  public get jumpsUsedCount(): number {
    return this.jumpsUsed;
  }

  /** Whether the player is standing on ground this frame (public read). */
  public get isGrounded(): boolean {
    return this.onGround;
  }

  /** Live tuning snapshot (used by the Milestone 2 debug overlay). */
  public get debugInfo(): {
    vx: number;
    vy: number;
    grounded: boolean;
    coyote: number;
    buffer: number;
  } {
    return {
      vx: this.body.velocity.x,
      vy: this.body.velocity.y,
      grounded: this.onGround,
      coyote: this.coyoteTimer,
      buffer: this.jumpBufferTimer,
    };
  }
}
