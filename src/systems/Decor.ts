import type Phaser from "phaser";
import { DecorArt } from "@/config/worldArt";
import { TileGid } from "@/config/Tiles";

/**
 * Scatters small non-colliding props (grass tufts, shrooms, rocks, the odd
 * bush) on top of exposed grass tiles. Purely visual: everything is placed
 * behind blocks/entities and has no physics. Placement is a deterministic
 * hash of the tile position, so a level always decorates identically —
 * across restarts and for every player.
 */

/** Roughly one prop per this many eligible grass tiles. */
const DENSITY = 5;

/** Deterministic 32-bit hash for a tile coordinate. */
function hashTile(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = (h * 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Pick a decor entry from the weighted table using a hash value. */
function pickDecor(h: number): (typeof DecorArt)[number] {
  const total = DecorArt.reduce((sum, d) => sum + d.weight, 0);
  let roll = h % total;
  for (const d of DecorArt) {
    if ((roll -= d.weight) < 0) return d;
  }
  return DecorArt[0];
}

/** Decorate all exposed grass-top tiles of the terrain layer. */
export function decorateTerrain(
  scene: Phaser.Scene,
  terrain: Phaser.Tilemaps.TilemapLayer,
  depth: number
): void {
  const map = terrain.tilemap;
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const tile = terrain.getTileAt(tx, ty);
      if (!tile || tile.index !== TileGid.GrassTop) continue;
      const above = terrain.getTileAt(tx, ty - 1);
      if (above && above.index > 0) continue; // buried or under spikes

      const h = hashTile(tx, ty);
      if (h % DENSITY !== 0) continue;

      const d = pickDecor((h >>> 4) % 997);
      const jitter = ((h >>> 12) % 13) - 6; // +-6px, breaks the grid feel
      const img = scene.add.image(
        tile.getCenterX() + jitter,
        tile.getTop() + 2, // sink 2px into the grass crest (no floating gap)
        d.key
      );
      img.setOrigin(0.5, 1);
      img.setScale(d.scale);
      img.setFlipX(((h >>> 20) & 1) === 1);
      img.setDepth(depth);
    }
  }
}
