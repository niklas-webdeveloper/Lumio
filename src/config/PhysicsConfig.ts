/**
 * ★ GAME-FEEL CONSTANTS ★
 * Every tunable that affects how the player moves and jumps lives here so the
 * feel can be dialed in from one place. Units:
 *   - distances in pixels (px)
 *   - speeds in px/second
 *   - accelerations in px/second²
 *   - times in milliseconds (ms)
 *
 * The defaults below are tuned for 32px tiles at 60 FPS:
 *   jump height ≈ v0² / (2·g) = 560² / (2·1800) ≈ 87px ≈ 2.7 tiles.
 */
export const Physics = {
  // ----- Gravity & falling -----
  /** Base downward gravity applied while rising. */
  GRAVITY_Y: 1800,
  /** Falling is heavier than rising for a weightier, snappier arc. */
  FALL_GRAVITY_MULTIPLIER: 1.6,
  /** Hard cap on downward speed (terminal velocity). */
  MAX_FALL_SPEED: 900,

  // ----- Horizontal movement -----
  /** Cruising speed when walking. */
  WALK_SPEED: 150,
  /** Top speed while the sprint key is held. */
  RUN_SPEED: 260,
  /** How quickly we ramp toward target speed on the ground. */
  GROUND_ACCEL: 1200,
  /** How quickly we ramp toward target speed in the air (less control). */
  AIR_ACCEL: 900,
  /** Deceleration toward 0 when no input is given, on the ground. */
  GROUND_FRICTION: 1600,
  /** Deceleration toward 0 when no input is given, in the air (floatier). */
  AIR_FRICTION: 320,
  /**
   * Extra acceleration multiplier applied when the player inputs the opposite
   * direction to current motion — makes turn-arounds feel crisp.
   */
  TURN_ACCEL_MULTIPLIER: 1.8,

  // ----- Jumping -----
  /** Initial upward velocity of a full jump (negative = up). */
  JUMP_VELOCITY: -560,
  /**
   * When the jump key is released while still rising, the upward velocity is
   * multiplied by this to cut the jump short (variable jump height).
   */
  JUMP_CUT_MULTIPLIER: 0.4,
  /** Allow jumping for this long after walking off a ledge. */
  COYOTE_TIME_MS: 100,
  /** A jump pressed within this window before landing is remembered. */
  JUMP_BUFFER_MS: 120,

  // ----- Stomp (used from Milestone 5) -----
  /** Upward bounce given to the player after stomping an enemy. */
  STOMP_BOUNCE_VELOCITY: -380,
} as const;

/**
 * Player body dimensions (placeholder art in Milestone 2; real sprite frames
 * are aligned to these in later milestones). Two sizes for small/big states.
 */
export const PlayerSize = {
  SMALL: { width: 22, height: 30 },
  BIG: { width: 26, height: 46 },
} as const;
