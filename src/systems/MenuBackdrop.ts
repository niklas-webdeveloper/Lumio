import Phaser from "phaser";
import { TextureKeys } from "@/config/AssetKeys";
import { GAME_WIDTH, GAME_HEIGHT } from "@/config/GameConfig";

/**
 * Sleek modern menu background: a deep gradient with glowing orbs (baked into
 * MenuBg) plus faint drifting light rays. Fills the camera view each frame so
 * it works under the supersampled (zoomed) menu cameras.
 */
export class MenuBackdrop {
  private readonly scene: Phaser.Scene;
  private readonly bg: Phaser.GameObjects.Image;
  private readonly rays: Phaser.GameObjects.TileSprite;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.bg = scene.add
      .image(0, 0, TextureKeys.MenuBg)
      .setOrigin(0, 0)
      .setDepth(-100);
    this.rays = scene.add
      .tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, TextureKeys.Rays)
      .setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.28)
      .setDepth(-95);
  }

  update(camera: Phaser.Cameras.Scene2D.Camera): void {
    const v = camera.worldView;
    this.bg.setPosition(v.x, v.y).setDisplaySize(v.width, v.height);
    this.rays.setPosition(v.x, v.y);
    this.rays.setSize(v.width, v.height);
    this.rays.tilePositionX = this.scene.time.now * 0.006;
  }
}
