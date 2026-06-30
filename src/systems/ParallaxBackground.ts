import Phaser from "phaser";
import { TextureKeys } from "@/config/AssetKeys";
import { GAME_WIDTH, GAME_HEIGHT } from "@/config/GameConfig";

/** Depths kept well behind gameplay so the background never overlaps it. */
const DEPTH = {
  sky: -100,
  rays: -95,
  hillsFar: -90,
  hillsNear: -80,
} as const;

interface ParallaxLayer {
  sprite: Phaser.GameObjects.TileSprite;
  factor: number; // texture scroll fraction (0 = static, 1 = with the world)
  bottomAnchored: boolean;
}

/**
 * Multi-layer parallax background. Layers live in world space and are
 * repositioned to the camera's view each frame, so they fill the screen under
 * both the zoomed, following gameplay camera and the static menu cameras. The
 * parallax depth comes from scrolling each layer's texture at a fraction of the
 * camera speed (tilePositionX); foliage layers also tile seamlessly.
 */
export class ParallaxBackground {
  private readonly scene: Phaser.Scene;
  private readonly sky: Phaser.GameObjects.Image;
  private readonly rays: Phaser.GameObjects.TileSprite;
  private readonly layers: ParallaxLayer[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.sky = scene.add
      .image(0, 0, TextureKeys.Sky)
      .setOrigin(0, 0)
      .setDepth(DEPTH.sky);

    this.rays = scene.add
      .tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, TextureKeys.Rays)
      .setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.5)
      .setDepth(DEPTH.rays);

    this.addFoliage(TextureKeys.HillsFar, 220, DEPTH.hillsFar, 0.15);
    this.addFoliage(TextureKeys.HillsNear, 240, DEPTH.hillsNear, 0.4);
  }

  private addFoliage(key: string, texHeight: number, depth: number, factor: number): void {
    const sprite = this.scene.add
      .tileSprite(0, 0, GAME_WIDTH, texHeight, key)
      .setOrigin(0, 1)
      .setDepth(depth);
    this.layers.push({ sprite, factor, bottomAnchored: true });
  }

  /** Reposition layers to the camera's view and drive the parallax scroll. */
  update(camera: Phaser.Cameras.Scene2D.Camera): void {
    // worldView is the actual visible world rect (accounts for zoom + centerOn),
    // unlike scrollX which is offset under zoom.
    const view = camera.worldView;
    const left = view.x;
    const top = view.y;

    this.sky.setPosition(left, top);
    this.sky.setDisplaySize(view.width, view.height);
    this.rays.setPosition(left, top);
    this.rays.setSize(view.width, view.height);
    this.rays.tilePositionX = left * 0.08 + this.scene.time.now * 0.004;

    for (const layer of this.layers) {
      layer.sprite.setPosition(left, top + view.height); // bottom-anchored to view
      layer.sprite.width = view.width;
      layer.sprite.tilePositionX = left * layer.factor;
    }
  }
}
