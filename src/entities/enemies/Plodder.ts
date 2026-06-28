import Phaser from "phaser";
import { TextureKeys } from "@/config/AssetKeys";
import { Physics } from "@/config/PhysicsConfig";
import { Enemy } from "./Enemy";

/** Plodder cruising speed (px/s). */
const PLODDER_SPEED = 52;

/**
 * Plodder: a Goomba-style walker. Paces left/right, reverses at walls, and —
 * crucially — turns around at ledges instead of marching off them. Defeated by
 * a stomp. Needs the terrain layer to probe for ground ahead.
 */
export class Plodder extends Enemy {
  public readonly stompable = true;
  private direction: 1 | -1 = -1;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly terrain: Phaser.Tilemaps.TilemapLayer
  ) {
    super(scene, x, y, TextureKeys.Plodder);
    this.setGravityY(Physics.GRAVITY_Y);
    this.setVelocityX(PLODDER_SPEED * this.direction);
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (this.dying) return;

    // Reverse when bumping a wall (or pipe/block, via the scene's colliders).
    if (this.body.blocked.left) this.direction = 1;
    else if (this.body.blocked.right) this.direction = -1;

    // Reverse at ledges: only while grounded, if there's no floor ahead.
    if (this.body.blocked.down && this.isLedgeAhead()) {
      this.direction = this.direction === 1 ? -1 : 1;
    }

    this.setVelocityX(PLODDER_SPEED * this.direction);
    this.setFlipX(this.direction === 1);
  }

  /** Probe a point just past the leading foot, one step down, for solid ground. */
  private isLedgeAhead(): boolean {
    const aheadX = this.x + this.direction * (this.body.halfWidth + 4);
    const belowY = this.body.bottom + 6;
    const tile = this.terrain.getTileAtWorldXY(aheadX, belowY);
    return !tile || !tile.collides;
  }
}
