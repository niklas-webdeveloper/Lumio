import Phaser from "phaser";
import type { Player } from "@/entities/Player";

/** Reward a Lucky Block can yield. */
export type RewardKind = "coin" | "growcap";

/** Scene events emitted by blocks, handled by GameScene. */
export const BlockEvents = {
  /** A Lucky Block was opened: payload { reward, x, y }. */
  LuckyReward: "block-lucky-reward",
  /** A brick was broken by a big player: payload { x, y }. */
  BrickBreak: "block-brick-break",
} as const;

export interface LuckyRewardPayload {
  reward: RewardKind;
  x: number;
  y: number;
}
export interface BrickBreakPayload {
  x: number;
  y: number;
}

/**
 * Base class for solid, bump-on-hit blocks. Uses a static body (the player
 * stands on / collides with it); the bump is a purely visual nudge. Subclasses
 * implement what happens when the player strikes the block from below.
 */
export abstract class Block extends Phaser.Physics.Arcade.Sprite {
  public declare body: Phaser.Physics.Arcade.StaticBody;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
  }

  /** A short upward nudge for tactile feedback when struck. */
  protected bump(): void {
    const restY = this.y;
    this.scene.tweens.add({
      targets: this,
      y: restY - 8,
      duration: 90,
      yoyo: true,
      ease: "Quad.out",
      onComplete: () => {
        this.y = restY;
      },
    });
  }

  /** Invoked by the scene when the player hits this block from underneath. */
  abstract hitFromBelow(player: Player): void;

  /**
   * Invoked when the player strikes this block from above — e.g. slamming down
   * with a ground pound. By default this yields the same result as a hit from
   * below, so a "?" block can be triggered from either side.
   */
  hitFromAbove(player: Player): void {
    this.hitFromBelow(player);
  }
}
