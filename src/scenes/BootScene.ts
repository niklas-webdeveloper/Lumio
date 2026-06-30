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

  create(): void {
    // Ensure the custom fonts are loaded before any text renders, so labels
    // are crisp from the first frame. Falls through quickly if unsupported.
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    const go = () => this.scene.start(SceneKeys.Preload);
    if (fonts?.load) {
      Promise.all([
        fonts.load("700 16px Orbitron"),
        fonts.load("900 16px Orbitron"),
        fonts.load("500 16px Rajdhani"),
        fonts.load("700 16px Rajdhani"),
        fonts.load("700 16px Fredoka"),
        fonts.load("700 16px Nunito"),
      ])
        .then(() => fonts.ready)
        .then(go)
        .catch(go);
    } else {
      go();
    }
  }
}
