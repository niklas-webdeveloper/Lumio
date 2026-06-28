import Phaser from "phaser";
import { TextureKeys } from "@/config/AssetKeys";
import type { Player } from "@/entities/Player";
import { Block, BlockEvents } from "./Block";

/**
 * A breakable brick. A big player smashes it (it shatters — fragment particles
 * are added in the polish milestone); a small player just bumps it harmlessly.
 */
export class BrickBlock extends Block {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TextureKeys.Brick);
  }

  hitFromBelow(player: Player): void {
    if (player.isBig) {
      this.scene.events.emit(BlockEvents.BrickBreak, { x: this.x, y: this.y });
      this.body.enable = false;
      this.scene.tweens.add({
        targets: this,
        scale: 0,
        alpha: 0,
        duration: 120,
        onComplete: () => this.destroy(),
      });
    } else {
      this.bump();
    }
  }
}
