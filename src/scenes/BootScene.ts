import Phaser from "phaser";
import { SceneKeys } from "@/config/AssetKeys";

/**
 * BootScene: the very first scene. Kept intentionally tiny — it only loads the
 * few assets needed to render a nice loading bar, then hands off to Preload.
 * (No heavy assets exist yet; this is the structural placeholder.)
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  preload(): void {
    // Future: load loading-bar / logo art here.
  }

  create(): void {
    this.scene.start(SceneKeys.Preload);
  }
}
