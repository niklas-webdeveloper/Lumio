import Phaser from "phaser";
import { TextureKeys } from "@/config/AssetKeys";
import type { Player } from "@/entities/Player";
import { Block, BlockEvents, REWARD_POOL } from "./Block";

/**
 * A "?" block. The first hit from below dispenses a *random* reward (coin,
 * Growcap cherry, fire-burst item or star gem) via a scene event, bumps, and
 * turns into a spent block. Further hits do nothing. The fixed `reward` the
 * level data may still carry is ignored — every block rolls the same pool.
 */
export class LuckyBlock extends Block {
  private spent = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
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
      reward: Phaser.Math.RND.pick(REWARD_POOL.slice()),
      x: this.x,
      y: this.y,
    });
  }
}
