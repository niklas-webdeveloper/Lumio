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
    // Ensure the fonts the UI actually uses are loaded before any menu text
    // renders, so labels are crisp from the first frame (no FOUT/pop-in). The
    // menus/HUD are Baloo 2; canvas text uses Fredoka/Nunito. A short timeout
    // guarantees we never block the game on a slow/failed font fetch.
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    const go = () => this.scene.start(SceneKeys.Preload);
    if (fonts?.load) {
      const load = Promise.all([
        fonts.load("700 16px 'Baloo 2'"),
        fonts.load("800 16px 'Baloo 2'"),
        fonts.load("600 16px 'Baloo 2'"),
        fonts.load("700 16px Fredoka"),
        fonts.load("700 16px Nunito"),
      ]).then(() => fonts.ready);
      const timeout = new Promise<void>((resolve) =>
        setTimeout(resolve, 2500)
      );
      Promise.race([load, timeout]).then(go).catch(go);
    } else {
      go();
    }
  }
}
