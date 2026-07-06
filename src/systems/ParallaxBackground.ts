import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "@/config/GameConfig";
import { BG_LAYERS, bgKey, type BgTheme } from "@/config/backgrounds";

/** Per-layer scroll fraction, far (L0) → near (L4). Smaller = slower = deeper. */
const PARALLAX_FACTORS = [0.1, 0.25, 0.45, 0.65, 0.9] as const;

/** Depths kept well behind gameplay so the background never overlaps it. */
const BASE_DEPTH = -100;

interface ParallaxLayer {
  sprite: Phaser.GameObjects.TileSprite;
  factor: number;
  /** Intrinsic source-artwork height (a TileSprite's own texture is its fill pattern). */
  texH: number;
}

/**
 * Themed multi-layer parallax background built from an artwork's 5 depth layers.
 * Each layer is a TileSprite living in world space that is repositioned to the
 * camera's view every frame and scaled so the *full* artwork height fits the
 * view (no zoom-crop — the whole scene is always visible under the 3× gameplay
 * camera). Horizontal depth comes from scrolling each layer's texture at a
 * fraction of the camera speed; the art tiles seamlessly as the camera pans.
 */
export class ParallaxBackground {
  private readonly layers: ParallaxLayer[] = [];
  /** Last-applied view size — the size/scale writes only need to re-run when
   *  the camera view changes (it's constant at the fixed zoom), not per frame. */
  private lastViewW = -1;
  private lastViewH = -1;

  constructor(scene: Phaser.Scene, theme: BgTheme) {
    for (let i = 0; i < BG_LAYERS; i++) {
      const key = bgKey(theme, i);
      // Capture the intrinsic artwork height before the TileSprite swaps its
      // own .texture for an internal fill pattern.
      const src = scene.textures.get(key).getSourceImage();
      const texH = src.height || GAME_HEIGHT;
      const sprite = scene.add
        .tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, key)
        .setOrigin(0, 0)
        .setDepth(BASE_DEPTH + i);
      this.layers.push({ sprite, factor: PARALLAX_FACTORS[i], texH });
    }
  }

  /** Horizontal overdraw (px) so no background gap can ever peek in at the sides. */
  private static readonly BLEED_X = 2;

  /** Reposition layers to the camera's view and drive the parallax scroll. */
  update(camera: Phaser.Cameras.Scene2D.Camera): void {
    // Guard against a torn-down camera during scene stop/restart transitions.
    if (!camera) return;
    // Compute the visible world rect exactly from the raw scroll. (worldView
    // rounds its x to whole pixels, which made the background jitter against
    // the camera by up to half a design pixel every frame.)
    const viewW = camera.displayWidth;
    const viewH = camera.displayHeight;
    const viewX = camera.scrollX + (camera.width - viewW) / 2;
    const viewY = camera.scrollY + (camera.height - viewH) / 2;
    const bleed = ParallaxBackground.BLEED_X;

    const resize = viewW !== this.lastViewW || viewH !== this.lastViewH;
    if (resize) {
      this.lastViewW = viewW;
      this.lastViewH = viewH;
    }

    for (const { sprite, factor, texH } of this.layers) {
      // Uniform scale so the whole artwork height exactly fills the view.
      const scale = viewH / texH;

      sprite.setPosition(viewX - bleed, viewY);
      if (resize) {
        sprite.setSize(viewW + bleed * 2, viewH);
        sprite.setTileScale(scale);
        sprite.tilePositionY = 0;
      }
      // Displayed scroll = tilePosition × tileScale, so divide by scale to get a
      // screen-space parallax offset of viewX × factor.
      sprite.tilePositionX = (viewX * factor) / scale;
    }
  }
}
