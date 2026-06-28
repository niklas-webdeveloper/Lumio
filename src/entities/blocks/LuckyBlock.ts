import Phaser from "phaser";
import { TextureKeys } from "@/config/AssetKeys";
import type { Player } from "@/entities/Player";
import { Block, BlockEvents, type RewardKind } from "./Block";

/**
 * A "?" block. The first hit from below dispenses its reward (coin or Growcap)
 * via a scene event, bumps, and turns into a spent block. Further hits do nothing.
 */
export class LuckyBlock extends Block {
  private spent = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly reward: RewardKind = "coin"
  ) {
    super(scene, x, y, TextureKeys.LuckyBlock);
  }

  hitFromBelow(_player: Player): void {
    if (this.spent) {
      this.bump();
      return;
    }
    this.spent = true;
    this.bump();
    this.setTexture(TextureKeys.UsedBlock);
    this.scene.events.emit(BlockEvents.LuckyReward, {
      reward: this.reward,
      x: this.x,
      y: this.y,
    });
  }
}
