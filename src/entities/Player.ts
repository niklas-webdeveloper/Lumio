import Phaser from "phaser";
import { Physics } from "@/config/PhysicsConfig";
import type { InputState } from "@/systems/InputManager";
import { PlaceholderKeys } from "@/systems/PlaceholderTextures";

/** Move a value toward a target by at most `maxDelta` (framerate-independent). */
function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return target;
}

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

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, PlaceholderKeys.PlayerSmall);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(0.5, 0.5);
    this.setCollideWorldBounds(true);
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
    const dt = deltaMs / 1000; // seconds for accel/velocity math
    const grounded = this.onGround;

    this.updateHorizontal(dt, grounded, input);
    this.updateTimers(deltaMs, grounded, input);
    this.updateJump(input);
    this.updateGravity();
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

    // Landing clears the "rising" flag used for jump-cut.
    if (grounded && this.body.velocity.y >= 0) {
      this.isJumpRising = false;
    }
  }

  /** Execute buffered jumps and apply variable-height jump-cut. */
  private updateJump(input: InputState): void {
    const canJump = this.coyoteTimer > 0;
    if (this.jumpBufferTimer > 0 && canJump) {
      this.setVelocityY(Physics.JUMP_VELOCITY);
      this.jumpBufferTimer = 0;
      this.coyoteTimer = 0;
      this.isJumpRising = true;
    }

    // Variable jump height: releasing while still rising cuts upward velocity.
    if (
      input.jumpJustReleased &&
      this.isJumpRising &&
      this.body.velocity.y < 0
    ) {
      this.setVelocityY(this.body.velocity.y * Physics.JUMP_CUT_MULTIPLIER);
      this.isJumpRising = false;
    }
  }

  /** Heavier gravity while falling than rising for a weighty feel. */
  private updateGravity(): void {
    const g =
      this.body.velocity.y > 0
        ? Physics.GRAVITY_Y * Physics.FALL_GRAVITY_MULTIPLIER
        : Physics.GRAVITY_Y;
    this.setGravityY(g);
  }

  /** Current facing direction (1 right, -1 left) — used by later animations. */
  public get facingDirection(): 1 | -1 {
    return this.facing;
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
