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
   * Total jumps available from the ground (2 = a mid-air double jump).
   * The second jump is an air jump usable once before landing.
   */
  MAX_JUMPS: 2,
  /**
   * Upward velocity of the mid-air double jump. Applied as a hard reset of
   * vertical speed so it always feels crisp, even while falling fast.
   */
  DOUBLE_JUMP_VELOCITY: -520,
  /** Duration of the double-jump flip spin (ms). */
  DOUBLE_JUMP_SPIN_MS: 360,
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
  /**
   * How far the player's feet were allowed to be above the enemy's head on
   * the previous physics step to still count as "landed from above". Checked
   * against the *previous* step (not the current, post-overlap position) so
   * that a fast fall — which can tunnel several pixels into the enemy in a
   * single step — doesn't get misread as a side hit.
   */
  STOMP_TOLERANCE_PX: 6,

  // ----- Ducking (crouch) -----
  /** Top horizontal speed while ducking — slower than a walk, but mobile. */
  CROUCH_SPEED: 80,

  // ----- Surface mechanics (per-tile physics overrides) -----
  /** Ground acceleration while standing on ice (much less grip). */
  ICE_ACCEL: 380,
  /** Deceleration toward 0 on ice with no input — a long, slick glide. */
  ICE_FRICTION: 90,
  /** Turn-around boost is disabled on ice (multiplier applied instead). */
  ICE_TURN_MULTIPLIER: 1.0,
  /** Max sink rate while wading in quicksand (px/s, downward). */
  QUICKSAND_SINK_SPEED: 32,
  /** Horizontal speed cap while in quicksand (wading is slow). */
  QUICKSAND_MAX_SPEED: 70,
  /** Jump impulse multiplier when jumping out of quicksand. */
  QUICKSAND_JUMP_MULTIPLIER: 0.95,

  // ----- Ground pound (down-slam) -----
  /** Brief hang while the slam winds up (velocity frozen), in ms. */
  GROUND_POUND_CHARGE_MS: 110,
  /** Downward slam speed during a ground pound (exceeds normal terminal). */
  GROUND_POUND_SPEED: 1000,
} as const;

/**
 * Player body dimensions (placeholder art in Milestone 2; real sprite frames
 * are aligned to these in later milestones). Two sizes for small/big states.
 */
export const PlayerSize = {
  SMALL: { width: 22, height: 30 },
  BIG: { width: 26, height: 46 },
} as const;
