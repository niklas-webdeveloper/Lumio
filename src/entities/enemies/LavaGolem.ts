import type Phaser from "phaser";
import { TextureKeys } from "@/config/AssetKeys";
import { WalkerEnemy } from "./WalkerEnemy";

/**
 * Lava Golem: the JJK/Sukuna ground enemy of level 6. A heavy molten-rock brute
 * that lumbers along a patrol with a weighty side-to-side waddle and a pulsing
 * ember glow. Slower than the Shadow Soldier but the same stomp rules apply.
 */
export class LavaGolem extends WalkerEnemy {
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    terrain: Phaser.Tilemaps.TilemapLayer
  ) {
    super(scene, x, y, terrain, {
      texture: TextureKeys.LavaGolem,
      speed: 34,
      scale: 0.68,
      bodyW: 34,
      bodyH: 50,
      facesRight: false,
      waddleDeg: 4,
      waddleFreq: 5,
      glowColor: 0xff6a1e,
      glowStrength: 2.2,
    });
  }
}
