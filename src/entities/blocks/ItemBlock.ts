import Phaser from "phaser";
import { TextureKeys } from "@/config/AssetKeys";
import type { Player } from "@/entities/Player";
import { Block, BlockEvents, type RewardKind } from "./Block";

/** How long the block stays spent before it re-arms with a fresh item. */
const RESPAWN_MS = 18_000;

/**
 * The boss-arena supply block: a "?" block that always dispenses something
 * USEFUL for the fight — a fire-burst or star item (or a Growcap when the
 * player is small and needs the save) — and re-arms after a good while, so
 * every character has a damage source against the boss, but item hits stay
 * a rationed resource instead of a stream.
 */
export class ItemBlock extends Block {
  private spent = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TextureKeys.LuckyBlock);
  }

  hitFromBelow(player: Player): void {
    if (this.spent) {
      this.bump();
      return;
    }
    this.spent = true;
    this.bump();
    this.setTexture(TextureKeys.UsedBlock);
    this.scene.events.emit(BlockEvents.LuckyReward, {
      reward: this.rollReward(player),
      x: this.x,
      y: this.y,
    });

    // Recharge: pulse faintly while spent, then pop back to a live "?".
    const pulse = this.scene.tweens.add({
      targets: this,
      alpha: { from: 1, to: 0.65 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
    this.scene.time.delayedCall(RESPAWN_MS, () => {
      pulse.remove();
      if (!this.active) return;
      this.spent = false;
      this.setAlpha(1);
      this.setTexture(TextureKeys.LuckyBlock);
      // Re-arm flourish: a white pop + a short sparkle burst.
      this.setTintFill(0xffffff);
      this.scene.time.delayedCall(90, () => this.active && this.clearTint());
      this.scene.tweens.add({
        targets: this,
        scale: { from: 1.25, to: 1 },
        duration: 180,
        ease: "Back.out",
      });
      const spark = this.scene.add
        .particles(this.x, this.y, TextureKeys.Spark, {
          lifespan: 500,
          speed: { min: 40, max: 110 },
          scale: { start: 0.5, end: 0 },
          alpha: { start: 1, end: 0 },
          tint: [0xffd95e, 0xfff2a8],
          blendMode: Phaser.BlendModes.ADD,
          quantity: 12,
          emitting: false,
        })
        .setDepth(this.depth + 1);
      spark.explode(12);
      this.scene.time.delayedCall(600, () => spark.destroy());
    });
  }

  /** Always combat-useful: item split 60/40, or a Growcap for a small player. */
  private rollReward(player: Player): RewardKind {
    if (!player.isBig && Math.random() < 0.5) return "growcap";
    return Math.random() < 0.6 ? "fireburst" : "star";
  }

  /** True while the block is waiting to recharge (test/inspection hook). */
  get isSpent(): boolean {
    return this.spent;
  }
}
