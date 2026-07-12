import Phaser from "phaser";
import { Physics } from "@/config/PhysicsConfig";
import { CHARACTERS, HERO_FRAME, type CharacterDef } from "@/config/characterAssets";
import type { InputState } from "@/systems/InputManager";
import { audioManager } from "@/systems/AudioManager";
import { saveState } from "@/systems/SaveState";

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
 * Character display + hitbox tuning. The art is a 128px frame, scaled down; the
 * physics body is a centered sub-box (in source px) covering the torso/legs with
 * its bottom edge at the character's feet (~y120). Arcade scales the body with
 * the sprite's scale, so growing = a larger scale with the same source box.
 */
const Hero = {
  SMALL_SCALE: 0.5,
  BIG_SCALE: 0.66,
  BODY_W: 40,
  BODY_H: 70,
  BODY_OX: (HERO_FRAME - 40) / 2, // horizontally centered (=44)
  BODY_OY: 120 - 70, // bottom edge at the feet line (=50)
  /** Vertical squash applied while ducking (shrinks the body + art to fit gaps). */
  CROUCH_SQUASH_Y: 0.6,
} as const;
/** Feet distance below the frame centre, in source px (for feet-planted resizes). */
const FEET_FROM_CENTER = Hero.BODY_OY + Hero.BODY_H - HERO_FRAME / 2; // 56
/** Brief window after touchdown during which the landing animation plays. */
const LAND_ANIM_MS = 170;

/**
 * The player character (Lumio or a shop character — same mechanics, different
 * sheets: all characters share the 128px cell layout and this physics tuning).
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

  /** Sheets + animation keys of the character being played this run. */
  private readonly char: CharacterDef;

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
  /** Remaining star-power time (ms); >0 means invincible + enemies die on touch. */
  private starTimer = 0;
  /** Accumulator driving the blink while invulnerable. */
  private blinkAccumulator = 0;
  /** Set once the player has died; control is suspended. */
  private dead = false;
  /** Ground state last frame (to detect touchdown for the landing anim). */
  private wasGrounded = true;
  /** Scene time until which the landing animation should hold. */
  private landingUntil = 0;

  /** True while ducking (crouched): smaller hit-box, slower, squashed pose. */
  private ducking = false;
  /** True while standing on an ice tile (low-grip movement). */
  private onIce = false;
  /** True while the feet are inside a quicksand tile (wading/sinking). */
  private inQuicksand = false;
  /** True during a down-slam (ground pound). */
  private groundPounding = false;
  /** Remaining wind-up hang before the slam actually drops (ms). */
  private groundPoundCharge = 0;

  // ----- Shadow dash (Jin-Woo) -----
  /** True while the shadow dash is active (invulnerable, velocity locked). */
  private dashing = false;
  /** Remaining dash time (ms). */
  private dashTimer = 0;
  /** Remaining cooldown until the next dash (ms). */
  private dashCooldown = 0;
  /** Direction of the active dash. */
  private dashDir: 1 | -1 = 1;
  /** Accumulator spawning shadow after-images along the dash. */
  private dashTrailAccum = 0;

  // ----- Wall jump (Foxy) -----
  /** True while sliding down a wall (soft fall, wall-jump ready). */
  private wallSliding = false;
  /** Grace window to still wall-jump after leaving the wall (ms). */
  private wallCoyoteTimer = 0;
  /** Which side the last touched wall was on (1 = right, -1 = left). */
  private lastWallDir: 1 | -1 = 1;
  /** Steering lock after a wall jump so the leap arcs away first (ms). */
  private steerLockTimer = 0;
  /** Throttle for the wall-slide dust effect (ms). */
  private wallDustAccum = 0;

  // ----- Water (swimming) -----
  /** True while the body is in a water zone (set by the scene each frame). */
  private inWater = false;
  /** World-y of the water surface / bed of the current zone. */
  private waterSurfaceY = 0;
  private waterBottomY = 0;
  /** Throttle for the underwater bubble trail (ms). */
  private bubbleAccum = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    const char = CHARACTERS[saveState.getSelectedCharacter()];
    super(scene, x, y, char.sheets.idle.key, 0);
    this.char = char;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(0.5, 0.5);
    this.setCollideWorldBounds(true);
    this.setSizeState("small");
    this.anims.play(this.char.anims.idle);
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
    // Wading: feet in quicksand and not moving upward. Counts as ground for
    // jumps (hop out) and animation, even though nothing blocks the body.
    const wading = this.inQuicksand && this.body.velocity.y >= 0;

    // Dash cooldown always ticks, even mid-jump or while pounding.
    if (this.dashCooldown > 0) this.dashCooldown = Math.max(0, this.dashCooldown - deltaMs);
    this.steerLockTimer = Math.max(0, this.steerLockTimer - deltaMs);

    // An active shadow dash overrides all normal control until it resolves.
    if (this.dashing) {
      this.updateDash(deltaMs);
      this.updateInvulnerability(deltaMs);
      this.updateStarPower(deltaMs);
      return;
    }
    // Special button: Jin-Woo's shadow dash (ground or air, cooldown-gated).
    if (
      input.specialJustPressed &&
      this.char.ability.id === "shadowdash" &&
      this.dashCooldown <= 0 &&
      !this.groundPounding
    ) {
      this.startDash(input);
      this.updateInvulnerability(deltaMs);
      this.updateStarPower(deltaMs);
      return;
    }

    // Swimming replaces the whole grounded/jump/gravity stack.
    if (this.inWater) {
      if (this.groundPounding) this.endGroundPound();
      this.updateSwim(dt, deltaMs, input);
      this.updateInvulnerability(deltaMs);
      this.updateStarPower(deltaMs);
      return;
    }

    // A ground pound overrides all normal control until it resolves.
    if (this.groundPounding) {
      // Slamming into quicksand "lands" the pound — and then you sink.
      if (this.inQuicksand) this.endGroundPound();
      else this.updateGroundPound(deltaMs, grounded);
      this.updateInvulnerability(deltaMs);
      this.updateStarPower(deltaMs);
      return;
    }
    // A fresh Down-press while airborne starts a slam (Mario-style pound).
    if (!grounded && !this.inQuicksand && input.downJustPressed) {
      this.startGroundPound();
      this.updateInvulnerability(deltaMs);
      this.updateStarPower(deltaMs);
      return;
    }

    this.updateCrouch(grounded, input);
    this.updateHorizontal(dt, grounded, input);
    this.updateTimers(deltaMs, grounded || wading, input);
    this.updateWallSlide(deltaMs, grounded, input);
    this.updateJump(input);
    this.updateGravity();
    this.applyWallSlideCap();
    this.applyQuicksandSink();
    this.updateInvulnerability(deltaMs);
    this.updateStarPower(deltaMs);
    this.updateAnimation(grounded || wading, input);
  }

  // ----- Shadow dash (Jin-Woo's ability) -----

  /** Begin the shadow dash: a fixed-speed horizontal blink with gravity off. */
  private startDash(input: InputState): void {
    this.dashing = true;
    this.dashTimer = Physics.DASH_DURATION_MS;
    this.dashTrailAccum = 0;
    this.dashDir = input.moveX !== 0 ? (input.moveX > 0 ? 1 : -1) : this.facing;
    this.facing = this.dashDir;
    this.setFlipX(this.facing === -1);
    this.standUp();
    this.endSpin();
    this.isJumpRising = false;
    // The normal horizontal cap (RUN_SPEED) would clamp the dash — raise it.
    this.body.setMaxVelocity(Physics.DASH_SPEED, Physics.MAX_FALL_SPEED);
    this.body.setVelocity(Physics.DASH_SPEED * this.dashDir, 0);
    this.setGravityY(0);
    this.anims.play(this.char.anims.dash, true);
    this.scene.events.emit("player-dash", this.x, this.y, this.dashDir);
  }

  /** Advance an active dash; holds the velocity and spawns the shadow trail. */
  private updateDash(deltaMs: number): void {
    this.dashTimer -= deltaMs;
    this.body.setVelocity(Physics.DASH_SPEED * this.dashDir, 0);
    this.setGravityY(0);

    // A ribbon of fading after-images marks the path (the "shadow" look).
    this.dashTrailAccum += deltaMs;
    while (this.dashTrailAccum >= Physics.DASH_TRAIL_INTERVAL_MS) {
      this.dashTrailAccum -= Physics.DASH_TRAIL_INTERVAL_MS;
      this.scene.events.emit("player-dash-trail", this);
    }

    // Hitting a wall ends the dash early (no grinding along the tile face).
    const blocked =
      this.dashDir === 1 ? this.body.blocked.right : this.body.blocked.left;
    if (this.dashTimer <= 0 || blocked) this.endDash();
  }

  /** Resolve the dash: restore physics caps and keep a bit of momentum. */
  private endDash(): void {
    this.dashing = false;
    this.dashTimer = 0;
    this.dashCooldown = Physics.DASH_COOLDOWN_MS;
    this.body.setMaxVelocity(Physics.RUN_SPEED, Physics.MAX_FALL_SPEED);
    const momentum = Math.min(
      Physics.DASH_SPEED * Physics.DASH_EXIT_MOMENTUM,
      Physics.RUN_SPEED
    );
    this.setVelocityX(momentum * this.dashDir);
  }

  // ----- Wall slide & wall jump (Foxy's ability) -----

  /** Detect the wall-slide state and keep the wall-coyote window fresh. */
  private updateWallSlide(deltaMs: number, grounded: boolean, input: InputState): void {
    this.wallCoyoteTimer = Math.max(0, this.wallCoyoteTimer - deltaMs);
    if (this.char.ability.id !== "walljump") {
      this.wallSliding = false;
      return;
    }
    const wallDir = this.body.blocked.right ? 1 : this.body.blocked.left ? -1 : 0;
    this.wallSliding =
      !grounded &&
      wallDir !== 0 &&
      input.moveX === wallDir &&
      this.body.velocity.y > 0;
    if (this.wallSliding) {
      this.lastWallDir = wallDir as 1 | -1;
      this.wallCoyoteTimer = Physics.WALL_COYOTE_MS;
      // Soft dust puffs where the paws grip the wall.
      this.wallDustAccum += deltaMs;
      if (this.wallDustAccum >= 90) {
        this.wallDustAccum = 0;
        const side = this.body.width / 2;
        this.scene.events.emit("player-wallslide", this.x + wallDir * side, this.y);
      }
    } else {
      this.wallDustAccum = 0;
    }
  }

  /** Cap the fall speed while pressed against a wall (applied after gravity). */
  private applyWallSlideCap(): void {
    if (this.wallSliding && this.body.velocity.y > Physics.WALL_SLIDE_SPEED) {
      this.setVelocityY(Physics.WALL_SLIDE_SPEED);
    }
  }

  /**
   * Per-frame surface flags, set by the scene from the tiles under the feet
   * and the water zones (the terrain/zones live there, not here). Must be
   * called before updatePlayer each frame.
   */
  public setSurfaceState(state: {
    ice: boolean;
    quicksand: boolean;
    water?: boolean;
    waterSurfaceY?: number;
    waterBottomY?: number;
  }): void {
    this.onIce = state.ice;
    this.inQuicksand = state.quicksand;

    const water = state.water ?? false;
    if (water) {
      this.waterSurfaceY = state.waterSurfaceY ?? 0;
      this.waterBottomY = state.waterBottomY ?? 0;
    }
    if (water !== this.inWater && !this.dead) {
      this.inWater = water;
      if (water) this.onEnterWater();
      else this.onExitWater();
    }
  }

  /** Plunge into water: splash, absorb most of the fall, reset the air jump. */
  private onEnterWater(): void {
    const impact = Math.max(0, this.body.velocity.y);
    this.setVelocityY(impact * Physics.WATER_ENTRY_DAMPING);
    this.standUp();
    this.groundPounding = false;
    this.groundPoundCharge = 0;
    this.endSpin();
    this.isJumpRising = false;
    this.scene.events.emit("player-splash", this.x, this.waterSurfaceY, impact);
  }

  /** Leave the water (usually a surface jump): restore air physics. */
  private onExitWater(): void {
    this.bubbleAccum = 0;
    // Grant the one air jump so leaving the water feels like a fresh jump arc.
    this.jumpsUsed = 1;
    if (this.body.velocity.y < 0) this.isJumpRising = true;
  }

  /**
   * Swim physics: soupy horizontal drift, tap-to-stroke upward paddling and a
   * full leap when jumping right at the surface. Replaces the grounded stack
   * (crouch/jump/gravity) while in a water zone.
   */
  private updateSwim(dt: number, deltaMs: number, input: InputState): void {
    // Horizontal: heavier accel/friction than air, low top speed.
    const targetSpeed = input.moveX * Physics.WATER_MAX_SPEED;
    const rate = input.moveX !== 0 ? Physics.WATER_ACCEL : Physics.WATER_FRICTION;
    this.setVelocityX(approach(this.body.velocity.x, targetSpeed, rate * dt));
    if (input.moveX !== 0) {
      this.facing = input.moveX > 0 ? 1 : -1;
      this.setFlipX(this.facing === -1);
    }

    // Vertical: light gravity, capped sink, strokes on tap.
    this.setGravityY(Physics.WATER_GRAVITY);
    const nearSurface =
      this.body.top - this.waterSurfaceY < Physics.SURFACE_JUMP_ZONE_PX;
    if (input.jumpJustPressed) {
      if (nearSurface) {
        // Breach: a full jump straight out of the water.
        this.setVelocityY(Physics.JUMP_VELOCITY * 0.92);
        this.isJumpRising = true;
        audioManager.play("jump");
        this.scene.events.emit("player-splash", this.x, this.waterSurfaceY, 260);
      } else {
        // Stroke: one crisp paddle upward.
        this.setVelocityY(Physics.SWIM_STROKE_VELOCITY);
        audioManager.play("swim");
        this.scene.events.emit("player-stroke", this.x, this.y);
      }
    }
    // Holding down dives a little faster than the passive sink; otherwise the
    // water caps the sink speed well below the air terminal velocity.
    if (input.down && this.body.velocity.y >= 0) {
      this.setVelocityY(Physics.WATER_MAX_SINK * 1.6);
    } else if (this.body.velocity.y > Physics.WATER_MAX_SINK) {
      this.setVelocityY(Physics.WATER_MAX_SINK);
    }

    // The lakebed acts as a soft floor: hold the feet on it. Velocity alone
    // isn't enough — gravity integrates a little sink every step, so the
    // position must be corrected too or the body slowly drifts out the bottom.
    const maxBottom = this.waterBottomY - 2;
    if (this.body.bottom > maxBottom) {
      this.y -= this.body.bottom - maxBottom;
      if (this.body.velocity.y > 0) this.setVelocityY(0);
    }

    // A gentle trail of bubbles while fully submerged.
    if (this.body.top > this.waterSurfaceY) {
      this.bubbleAccum += deltaMs;
      if (this.bubbleAccum >= 380) {
        this.bubbleAccum = 0;
        this.scene.events.emit("player-bubble", this.x, this.body.top + 4);
      }
    }

    // Swim pose: rising = jump sheet, sinking = fall sheet, both slowed.
    this.anims.play(
      this.body.velocity.y < -30 ? this.char.anims.jump : this.char.anims.fall,
      true
    );
    this.anims.timeScale = 0.6;
    this.wasGrounded = false;
  }

  /**
   * Sand is viscous: while wading (not rising from a jump) the sand fully
   * absorbs any fall speed and pulls the player down at a slow, constant
   * rate — plunging in from a jump grabs you at the surface instead of
   * letting you shoot to the bottom.
   */
  private applyQuicksandSink(): void {
    if (!this.inQuicksand || this.body.velocity.y < 0) return;
    this.setGravityY(0);
    this.setVelocityY(Physics.QUICKSAND_SINK_SPEED);
  }

  /** Toggle the crouched state from held Down while standing on the ground. */
  private updateCrouch(grounded: boolean, input: InputState): void {
    const wantDuck = grounded && input.down;
    if (wantDuck && !this.ducking) {
      this.ducking = true;
      this.applyCrouchScale(true);
    } else if (!wantDuck && this.ducking) {
      this.ducking = false;
      this.applyCrouchScale(false);
    }
  }

  /**
   * Squash (or restore) the sprite vertically for the duck. The physics body is
   * scaled with the sprite, so this both shrinks the hit-box (fit through low
   * gaps) and reads as a crouch. Feet stay planted while grounded.
   */
  private applyCrouchScale(duck: boolean): void {
    const base = this.baseScale;
    const targetScaleY = duck ? base * Hero.CROUCH_SQUASH_Y : base;
    const oldScaleY = this.scaleY;
    this.setScale(base, targetScaleY);
    // Keep the feet on the ground as the body height changes.
    if (this.onGround) {
      this.y += FEET_FROM_CENTER * (oldScaleY - targetScaleY);
    }
  }

  /** The uniform scale for the current power level (before any crouch squash). */
  private get baseScale(): number {
    return this.size === "big" ? Hero.BIG_SCALE : Hero.SMALL_SCALE;
  }

  // ----- Ground pound (down-slam) -----

  /** Begin a ground pound: a short hang, a flip, then a fast dive straight down. */
  private startGroundPound(): void {
    this.groundPounding = true;
    this.groundPoundCharge = Physics.GROUND_POUND_CHARGE_MS;
    this.isJumpRising = false;
    this.body.setVelocity(0, 0);
    this.setGravityY(0);
    // Allow the slam to exceed normal terminal velocity for a weighty drop.
    this.body.setMaxVelocity(Physics.RUN_SPEED, Physics.GROUND_POUND_SPEED);
    this.anims.play(this.char.anims.fall, true);
    this.startSpin(); // reuse the double-jump flip as the wind-up
    audioManager.play("jump");
  }

  /** Advance an active ground pound; resolves on touchdown. */
  private updateGroundPound(deltaMs: number, grounded: boolean): void {
    if (grounded) {
      this.endGroundPound();
      return;
    }
    if (this.groundPoundCharge > 0) {
      // Wind-up hang: hold in place while the flip plays.
      this.groundPoundCharge -= deltaMs;
      this.body.setVelocity(0, 0);
      this.setGravityY(0);
    } else {
      // Dive straight down at slam speed.
      this.setVelocityX(0);
      this.setVelocityY(Physics.GROUND_POUND_SPEED);
      this.setGravityY(0);
      this.anims.play(this.char.anims.fall, true);
    }
  }

  /** Land the slam: restore physics and play the impact landing. */
  private endGroundPound(): void {
    this.groundPounding = false;
    this.groundPoundCharge = 0;
    this.endSpin();
    this.body.setMaxVelocity(Physics.RUN_SPEED, Physics.MAX_FALL_SPEED);
    this.setVelocityY(0);
    this.landingUntil = this.scene.time.now + LAND_ANIM_MS;
    this.wasGrounded = true;
    this.anims.play(this.char.anims.land, true);
    audioManager.play("stomp");
    this.scene.events.emit("player-groundpound-land", this.x, this.body.bottom);
  }

  /** Pick and play the right character animation for the current motion. */
  private updateAnimation(grounded: boolean, input: InputState): void {
    const vx = this.body.velocity.x;
    const vy = this.body.velocity.y;
    const now = this.scene.time.now;

    // Touchdown -> play the one-shot landing animation briefly.
    if (grounded && !this.wasGrounded) {
      this.landingUntil = now + LAND_ANIM_MS;
      this.anims.play(this.char.anims.land, true);
    }
    this.wasGrounded = grounded;

    // Wall slide: hold the climb/grip pose against the wall (Foxy has real
    // climb art; other sheets fall back to the falling pose).
    if (this.wallSliding) {
      this.anims.stop();
      if (this.char.wallSlide) {
        this.setTexture(this.char.wallSlide.key, this.char.wallSlide.frame);
      } else {
        this.anims.play(this.char.anims.fall, true);
      }
      return;
    }

    if (!grounded) {
      if (vy < -20) {
        // Rising: a running jump when carrying speed, else a normal jump.
        const fast = Math.abs(vx) > Physics.WALK_SPEED * 0.6;
        this.anims.play(fast ? this.char.anims.runjump : this.char.anims.jump, true);
      } else {
        this.anims.play(this.char.anims.fall, true);
      }
      this.anims.timeScale = 1;
      return;
    }

    // Crouched: a slow shuffle when moving, otherwise the (squashed) idle pose.
    if (this.ducking) {
      if (Math.abs(vx) > 8) {
        this.anims.play(this.char.anims.run, true);
        this.anims.timeScale = 0.7;
      } else {
        this.anims.play(this.char.anims.idle, true);
        this.anims.timeScale = 1;
      }
      return;
    }

    // Hold the landing pose while it plays out and we're basically still.
    if (now < this.landingUntil && Math.abs(vx) < 24) return;

    if (Math.abs(vx) > 8) {
      const sprinting = input.run && Math.abs(vx) > Physics.WALK_SPEED * 1.05;
      this.anims.play(sprinting ? this.char.anims.dash : this.char.anims.run, true);
      this.anims.timeScale = Phaser.Math.Clamp(
        Math.abs(vx) / Physics.WALK_SPEED,
        0.8,
        1.6
      );
    } else {
      this.anims.play(this.char.anims.idle, true);
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

  /** Activate star power: invincible for `durationMs`, enemies die on touch. */
  public activateStar(durationMs: number): void {
    if (this.dead) return;
    this.starTimer = durationMs;
  }

  /** Tick star power and cycle a rainbow tint while it's active. */
  private updateStarPower(deltaMs: number): void {
    if (this.starTimer <= 0) return;
    this.starTimer -= deltaMs;
    if (this.starTimer <= 0) {
      this.starTimer = 0;
      this.clearTint();
      return;
    }
    // Rainbow shimmer; flicker faster in the last second as a running-out cue.
    const speed = this.starTimer < 1000 ? 0.9 : 0.35;
    const hue = (this.scene.time.now * speed) % 360;
    const c = Phaser.Display.Color.HSVToRGB(hue / 360, 0.55, 1) as Phaser.Display.Color;
    this.setTint(c.color);
  }

  /** True while star power (5s on-demand invincibility) is active. */
  public get isStarPowered(): boolean {
    return this.starTimer > 0;
  }

  /** Acceleration / friction horizontal movement with crisp turn-arounds. */
  private updateHorizontal(dt: number, grounded: boolean, input: InputState): void {
    // Post-wall-jump steering lock: keep the kick-off momentum untouched.
    if (this.steerLockTimer > 0) return;
    let maxSpeed: number = this.ducking
      ? Physics.CROUCH_SPEED
      : input.run
        ? Physics.RUN_SPEED
        : Physics.WALK_SPEED;
    // Quicksand: wading is slow no matter how hard you push.
    if (this.inQuicksand) maxSpeed = Math.min(maxSpeed, Physics.QUICKSAND_MAX_SPEED);
    const targetSpeed = input.moveX * maxSpeed;

    const slick = grounded && this.onIce; // low-grip rates on ice
    let rate: number;
    if (input.moveX !== 0) {
      rate = grounded
        ? slick
          ? Physics.ICE_ACCEL
          : Physics.GROUND_ACCEL
        : Physics.AIR_ACCEL;
      // Reversing direction? Apply a boost so turns feel snappy, not sluggish.
      const reversing =
        this.body.velocity.x !== 0 &&
        Math.sign(input.moveX) !== Math.sign(this.body.velocity.x);
      if (reversing) {
        rate *= slick ? Physics.ICE_TURN_MULTIPLIER : Physics.TURN_ACCEL_MULTIPLIER;
      }

      this.facing = input.moveX > 0 ? 1 : -1;
      this.setFlipX(this.facing === -1);
    } else {
      // No input: decelerate toward a stop (slides a touch, never abrupt).
      rate = grounded
        ? slick
          ? Physics.ICE_FRICTION
          : Physics.GROUND_FRICTION
        : Physics.AIR_FRICTION;
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
      // Jumping out of quicksand is possible, but the sand saps some power.
      this.startJump(
        Physics.JUMP_VELOCITY *
          (this.inQuicksand ? Physics.QUICKSAND_JUMP_MULTIPLIER : 1)
      );
      this.jumpsUsed = 1;
      this.jumpBufferTimer = 0;
      this.coyoteTimer = 0;
      audioManager.play("jump");
      this.scene.events.emit("player-jump", this.x, this.body.bottom);
    } else if (
      input.jumpJustPressed &&
      !this.onGround &&
      this.char.ability.id === "walljump" &&
      this.wallCoyoteTimer > 0
    ) {
      // Wall jump: kick off away from the wall; steering locks briefly so the
      // leap arcs out before the player can pull back in. Restores the air
      // jump, so wall → double jump chains work.
      this.wallCoyoteTimer = 0;
      this.wallSliding = false;
      this.steerLockTimer = Physics.WALL_JUMP_LOCK_MS;
      this.facing = this.lastWallDir === 1 ? -1 : 1;
      this.setFlipX(this.facing === -1);
      this.setVelocity(Physics.WALL_JUMP_VX * this.facing, Physics.WALL_JUMP_VY);
      this.isJumpRising = true;
      this.jumpsUsed = 1;
      this.anims.play(this.char.anims.runjump, true);
      audioManager.play("walljump");
      this.scene.events.emit(
        "player-walljump",
        this.x + this.lastWallDir * (this.body.width / 2),
        this.y
      );
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

  /** Leave the crouched state and restore the standing hit-box, if ducking. */
  private standUp(): void {
    if (!this.ducking) return;
    this.ducking = false;
    this.applyCrouchScale(false);
  }

  /** Apply the scale + centered hit-box for the current power level. */
  private setSizeState(size: PlayerSizeState): void {
    this.size = size;
    this.setScale(size === "big" ? Hero.BIG_SCALE : Hero.SMALL_SCALE);
    // Source-pixel box; Arcade multiplies it by the sprite scale.
    this.body.setSize(Hero.BODY_W, Hero.BODY_H, false);
    this.body.setOffset(Hero.BODY_OX, Hero.BODY_OY);
  }

  /** Grow from small to big (Growcap power-up). No-op if already big. */
  public grow(): void {
    if (this.dead || this.size === "big") return;
    this.standUp(); // resize from a clean standing pose
    const dy = FEET_FROM_CENTER * (Hero.BIG_SCALE - Hero.SMALL_SCALE);
    this.setSizeState("big");
    this.y -= dy; // keep feet planted as the body grows downward
    // A quick squash-and-stretch pop, settling at the big scale.
    this.scene.tweens.add({
      targets: this,
      scaleX: { from: Hero.BIG_SCALE * 1.18, to: Hero.BIG_SCALE },
      scaleY: { from: Hero.BIG_SCALE * 0.85, to: Hero.BIG_SCALE },
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
    // The shadow dash phases through danger — untouchable while it lasts.
    if (this.invulnTimer > 0 || this.starTimer > 0 || this.dashing) {
      return "invulnerable";
    }

    if (this.size === "big") {
      this.standUp(); // resize from a clean standing pose
      const dy = FEET_FROM_CENTER * (Hero.BIG_SCALE - Hero.SMALL_SCALE);
      this.setSizeState("small");
      this.y += dy;
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
    this.starTimer = 0;
    this.clearTint();
    this.groundPounding = false;
    this.dashing = false;
    this.wallSliding = false;
    this.inWater = false;
    this.standUp();
    this.body.setMaxVelocity(Physics.RUN_SPEED, Physics.MAX_FALL_SPEED);
    this.setAlpha(1);
    this.endSpin();
    this.anims.play(this.char.anims.fall, true); // tumble during the death arc
    this.setTint(0xff7a8a); // brief "hurt" flush
    this.body.setVelocity(0, -380); // hop up...
    this.setGravityY(Physics.GRAVITY_Y);
    this.body.checkCollision.none = true; // ...then fall through everything
  }

  // ----- Level-end pole slide (scripted; the scene drives the motion) -----

  /**
   * Enter the flag-pole grab: physics off (the scene tweens the sprite), any
   * active states cleared, and a held mid-jump frame doubling as a climb pose
   * (there is no dedicated climb sheet).
   */
  public beginPoleSlide(facePole: 1 | -1): void {
    this.groundPounding = false;
    this.groundPoundCharge = 0;
    this.dashing = false;
    this.wallSliding = false;
    this.body.setMaxVelocity(Physics.RUN_SPEED, Physics.MAX_FALL_SPEED);
    this.endSpin();
    this.standUp();
    this.invulnTimer = 0;
    this.starTimer = 0;
    this.clearTint();
    this.setAlpha(1);
    this.body.setVelocity(0, 0);
    this.body.setAllowGravity(false);
    this.body.moves = false;
    this.body.checkCollision.none = true;
    this.setFlipX(facePole === -1);
    this.anims.stop();
    // A held pose that reads as gripping the pole (per-character frame).
    this.setTexture(this.char.poleGrab.key, this.char.poleGrab.frame);
  }

  /** Pose for the little hop off the pole at the bottom of the slide. */
  public poseHopOff(direction: 1 | -1): void {
    this.facing = direction;
    this.setFlipX(direction === -1);
    this.anims.stop();
    this.setTexture(this.char.poleHop.key, this.char.poleHop.frame);
  }

  /** Touchdown after the hop: landing animation settling into idle. */
  public poseLandCelebrate(): void {
    this.anims.play(this.char.anims.land, true);
    this.anims.chain(this.char.anims.idle);
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

  /** True while ducking (crouched with a reduced hit-box). */
  public get isCrouching(): boolean {
    return this.ducking;
  }

  /** True while standing on an ice tile (set by the scene each frame). */
  public get isOnIce(): boolean {
    return this.onIce;
  }

  /** True while wading in quicksand (set by the scene each frame). */
  public get isInQuicksand(): boolean {
    return this.inQuicksand;
  }

  /** True while a ground pound (down-slam) is in progress. */
  public get isGroundPounding(): boolean {
    return this.groundPounding;
  }

  /** True while the shadow dash is active (phases through enemies/hazards). */
  public get isDashing(): boolean {
    return this.dashing;
  }

  /** Remaining dash cooldown as 0..1 (0 = ready) — drives the special button. */
  public get specialCooldownFrac(): number {
    if (this.char.ability.id !== "shadowdash") return 0;
    return Phaser.Math.Clamp(this.dashCooldown / Physics.DASH_COOLDOWN_MS, 0, 1);
  }

  /** True while sliding down a wall (wall-jump ready). */
  public get isWallSliding(): boolean {
    return this.wallSliding;
  }

  /** True while swimming in a water zone. */
  public get isInWater(): boolean {
    return this.inWater;
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
