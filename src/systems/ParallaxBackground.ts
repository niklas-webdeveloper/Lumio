import Phaser from "phaser";
import { TextureKeys } from "@/config/AssetKeys";
import { GAME_WIDTH, GAME_HEIGHT } from "@/config/GameConfig";

/** Depths kept well behind gameplay so the background never overlaps it. */
const DEPTH = {
  sky: -100,
  hillsFar: -90,
  hillsNear: -80,
} as const;

interface ParallaxLayer {
  sprite: Phaser.GameObjects.TileSprite;
  factor: number; // 0 = static, 1 = moves with the world
}

/**
 * Multi-layer parallax background. The sky is a fixed gradient; two hill layers
 * scroll their textures at fractions of the camera speed to fake depth. Layers
 * are screen-fixed (scrollFactor 0) and scrolled via tilePositionX instead, so
 * they tile seamlessly no matter how wide the level is.
 */
export class ParallaxBackground {
  private readonly layers: ParallaxLayer[] = [];

  constructor(scene: Phaser.Scene) {
    // Static gradient sky, pinned to the viewport.
    scene.add
      .image(0, 0, TextureKeys.Sky)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.sky);

    this.addHillLayer(scene, TextureKeys.HillsFar, 200, DEPTH.hillsFar, 0.15);
    this.addHillLayer(scene, TextureKeys.HillsNear, 220, DEPTH.hillsNear, 0.4);
  }

  private addHillLayer(
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
  }
}
