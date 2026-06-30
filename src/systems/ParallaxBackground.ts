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
  factor: number; // 0 = static, 1 = moves with the world
}

/**
 * Multi-layer parallax background for a bright, modern look: a gradient sky with
 * a sun glow, soft additive god-rays that drift, then two fluffy foliage layers
 * that scroll at fractions of the camera speed. Foliage layers are screen-fixed
 * (scrollFactor 0) and scrolled via tilePositionX so they tile seamlessly.
 */
export class ParallaxBackground {
  private readonly layers: ParallaxLayer[] = [];
  private readonly rays: Phaser.GameObjects.TileSprite;

  constructor(scene: Phaser.Scene) {
    // Static gradient sky + sun, pinned to the viewport.
    scene.add
      .image(0, 0, TextureKeys.Sky)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.sky);

    // Additive god-rays, faint and slowly drifting.
    this.rays = scene.add
      .tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, TextureKeys.Rays)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.5)
      .setDepth(DEPTH.rays);

    this.addFoliageLayer(scene, TextureKeys.HillsFar, 220, DEPTH.hillsFar, 0.15);
    this.addFoliageLayer(scene, TextureKeys.HillsNear, 240, DEPTH.hillsNear, 0.4);
  }

  private addFoliageLayer(
    scene: Phaser.Scene,
    key: string,
    texHeight: number,
    depth: number,
    factor: number
  ): void {
    const sprite = scene.add
      .tileSprite(0, GAME_HEIGHT, GAME_WIDTH, texHeight, key)
      .setOrigin(0, 1) // anchor to the bottom of the screen
      .setScrollFactor(0)
      .setDepth(depth);
    this.layers.push({ sprite, factor });
  }

  /** Call each frame with the camera's horizontal scroll to drive parallax. */
  update(cameraScrollX: number): void {
    for (const layer of this.layers) {
      layer.sprite.tilePositionX = cameraScrollX * layer.factor;
    }
    // Gentle independent drift so the light feels alive.
    this.rays.tilePositionX = cameraScrollX * 0.08 + this.rays.scene.time.now * 0.004;
  }
}
