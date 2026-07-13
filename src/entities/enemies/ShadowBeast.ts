import type Phaser from "phaser";
import { TextureKeys, EnemyAnim } from "@/config/AssetKeys";
import { WalkerEnemy } from "./WalkerEnemy";

/**
 * Shadow Beast: the minion the Shadow Monarch summons mid-fight — the black
 * clawed creature from the same Solo Leveling sheet as the soldier. Faster
 * and twitchier than the knight, but just as stompable: the adds keep the
 * player moving between the boss's own patterns.
 */
export class ShadowBeast extends WalkerEnemy {
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    terrain: Phaser.Tilemaps.TilemapLayer
  ) {
    super(scene, x, y, terrain, {
      texture: TextureKeys.ShadowBeast,
      anim: EnemyAnim.shadowBeastProwl,
      speed: 74,
      scale: 1,
      bodyW: 26,
      bodyH: 36,
      facesRight: true,
      glowColor: 0x8a5cff,
      glowStrength: 1.6,
    });
  }
}
