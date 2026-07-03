import Phaser from "phaser";
import { RENDER_SCALE, GAME_HEIGHT } from "@/config/GameConfig";

/** Camera tuning — horizontal-only follow; a deadzone prevents side-to-side jitter. */
const CameraConfig = {
  /** Deadzone width (px): the target can move within this box without scrolling. */
  DEADZONE_WIDTH: 140,
  /** Follow smoothing (0..1). Higher = snappier. */
  LERP_X: 0.14,
} as const;

/**
 * Wraps the main camera: follows a target horizontally only. The vertical scroll
 * is locked so the view never moves up/down when the player jumps or lands —
 * that motion was disorienting during play. We pin the camera vertically by
 * constraining its scrollable bounds to a single view-height slice at the bottom
 * of the level, which keeps the ground steady while X still tracks the player.
 */
export class CameraManager {
  private readonly camera: Phaser.Cameras.Scene2D.Camera;

  constructor(
    scene: Phaser.Scene,
    target: Phaser.GameObjects.GameObject,
    worldWidth: number,
    worldHeight: number
  ) {
    this.camera = scene.cameras.main;
    // Render the world at the design view (640×360) supersampled by RENDER_SCALE.
    this.camera.setZoom(RENDER_SCALE);
    // Bounds are exactly one view tall (in design units), pinned to the bottom of
    // the level: vertical scroll range collapses to zero, so scrollY never moves.
    const viewHeight = GAME_HEIGHT;
    const lockedTop = Math.max(0, worldHeight - viewHeight);
    this.camera.setBounds(0, lockedTop, worldWidth, viewHeight);
    this.camera.startFollow(target, true, CameraConfig.LERP_X, CameraConfig.LERP_X);
    // Horizontal-only deadzone (height 0: vertical follow is inert anyway).
    this.camera.setDeadzone(CameraConfig.DEADZONE_WIDTH, 0);
  }

  /** Current horizontal scroll (used to drive parallax). */
  get scrollX(): number {
    return this.camera.scrollX;
  }
}
