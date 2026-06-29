import Phaser from "phaser";

/** Duration of scene fades (ms). */
const FADE_MS = 250;

/** Fade the scene's camera in from black (call in a scene's create). */
export function fadeIn(scene: Phaser.Scene): void {
  scene.cameras.main.fadeIn(FADE_MS, 0, 0, 0);
}

/** Fade out to black, then run `onComplete` (e.g. start the next scene). */
export function fadeOutThen(scene: Phaser.Scene, onComplete: () => void): void {
  const cam = scene.cameras.main;
  cam.fadeOut(FADE_MS, 0, 0, 0);
  cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, onComplete);
}
