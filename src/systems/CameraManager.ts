import Phaser from "phaser";

/** Camera tuning — a deadzone prevents jitter; gentle lerp smooths motion. */
const CameraConfig = {
  /** Deadzone size (px): the target can move within this box without scrolling. */
  DEADZONE_WIDTH: 140,
  DEADZONE_HEIGHT: 90,
  /** Follow smoothing (0..1). Higher = snappier. */
  LERP_X: 0.14,
  LERP_Y: 0.12,
} as const;

/**
 * Wraps the main camera: bounded to the level, follows a target with a deadzone
 * (so small movements don't shake the view), and exposes a shake() used by
 * later polish (e.g. on stomp).
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
    this.camera.setBounds(0, 0, worldWidth, worldHeight);
    this.camera.setRoundPixels(true);
    this.camera.startFollow(target, true, CameraConfig.LERP_X, CameraConfig.LERP_Y);
    this.camera.setDeadzone(
      CameraConfig.DEADZONE_WIDTH,
      CameraConfig.DEADZONE_HEIGHT
    );
  }

  /** Current horizontal scroll (used to drive parallax). */
  get scrollX(): number {
    return this.camera.scrollX;
  }

  /** Brief screen shake — duration in ms, intensity as a fraction of viewport. */
  shake(durationMs = 120, intensity = 0.006): void {
    this.camera.shake(durationMs, intensity);
  }
}
