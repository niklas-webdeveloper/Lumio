import type Phaser from "phaser";
import { TextureKeys, EnemyAnim } from "@/config/AssetKeys";
import { WalkerEnemy } from "./WalkerEnemy";

/**
 * Shadow Soldier: the Solo Leveling ground enemy of level 5. An armored knight
 * that marches a patrol, brandishing a glowing blue blade (a slow 2-frame
 * cadence) wrapped in a pulsing arcane aura. Stomp to defeat, like a Plodder.
 */
export class ShadowSoldier extends WalkerEnemy {
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    terrain: Phaser.Tilemaps.TilemapLayer
  ) {
    super(scene, x, y, terrain, {
      texture: TextureKeys.ShadowSoldier,
      anim: EnemyAnim.shadowSoldierMarch,
      speed: 46,
      scale: 0.85,
      bodyW: 24,
      bodyH: 46,
      facesRight: true,
      glowColor: 0x49b6ff,
      glowStrength: 2,
    });
  }
}
