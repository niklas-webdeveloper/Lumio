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

  // ----- Shadow dash (Jin-Woo's character ability) -----
  /** Horizontal speed during the dash (well above RUN_SPEED). */
  DASH_SPEED: 660,
  /** How long the dash lasts (ms) — gravity off, velocity locked. */
  DASH_DURATION_MS: 190,
  /** Cooldown between dashes (ms); mirrored on the special button. */
  DASH_COOLDOWN_MS: 2000,
  /** Fraction of dash speed kept as momentum when the dash ends. */
  DASH_EXIT_MOMENTUM: 0.55,
  /** Interval between shadow after-images spawned along the dash (ms). */
  DASH_TRAIL_INTERVAL_MS: 26,

  // ----- Wall jump (Foxy's character ability) -----
  /** Max slide speed while pressed against a wall (soft fall). */
  WALL_SLIDE_SPEED: 100,
  /** Horizontal kick-off speed away from the wall. */
  WALL_JUMP_VX: 310,
  /** Upward impulse of a wall jump. */
  WALL_JUMP_VY: -540,
  /** Steering lock after a wall jump so the leap arcs away first (ms). */
  WALL_JUMP_LOCK_MS: 130,
  /** Grace window to still wall-jump shortly after leaving the wall (ms). */
  WALL_COYOTE_MS: 90,

  // ----- Water (swimming — Tropic Lagoon) -----
  /** Gravity while submerged (water carries most of the weight). */
  WATER_GRAVITY: 460,
  /** Terminal sink speed in water. */
  WATER_MAX_SINK: 120,
  /** Horizontal speed cap while swimming. */
  WATER_MAX_SPEED: 130,
  /** Horizontal acceleration in water (sluggish, soupy). */
  WATER_ACCEL: 520,
  /** Horizontal deceleration in water with no input. */
  WATER_FRICTION: 300,
  /** Upward impulse of one swim stroke (tap jump while submerged). */
  SWIM_STROKE_VELOCITY: -280,
  /** Within this distance of the surface a jump leaps fully out of the water. */
  SURFACE_JUMP_ZONE_PX: 14,
  /** Fraction of the fall speed kept when plunging into water (the rest splashes away). */
  WATER_ENTRY_DAMPING: 0.35,
} as const;

/**
 * Player body dimensions (placeholder art in Milestone 2; real sprite frames
 * are aligned to these in later milestones). Two sizes for small/big states.
 */
export const PlayerSize = {
  SMALL: { width: 22, height: 30 },
  BIG: { width: 26, height: 46 },
} as const;
