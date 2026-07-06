import Phaser from "phaser";
import { TextureKeys } from "@/config/AssetKeys";

/**
 * A solid pipe obstacle. Placed with its base on the ground (origin 0.5,1).
 * Exposes its mouth position so a Snapvine can be anchored to emerge from it.
 */
export class Pipe extends Phaser.Physics.Arcade.Sprite {
  public declare body: Phaser.Physics.Arcade.StaticBody;

  constructor(
    scene: Phaser.Scene,
    x: number,
    groundY: number,
    textureKey: string = TextureKeys.Pipe
  ) {
    super(scene, x, groundY, textureKey);
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.setOrigin(0.5, 1);
    this.body.updateFromGameObject(); // re-sync body after the origin change
  }

  /** X of the pipe mouth (its centre). */
  public get mouthX(): number {
    return this.x;
  }

  /** Y of the pipe rim (top edge). */
  public get mouthY(): number {
    return this.y - this.height;
  }
}
