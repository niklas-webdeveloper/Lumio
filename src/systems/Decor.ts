import type Phaser from "phaser";
import { decorSetFor, type DecorProp } from "@/config/themedArt";
import type { BgTheme } from "@/config/backgrounds";
import { TileGid } from "@/config/Tiles";

/**
 * Scatters small non-colliding props on top of exposed ground tiles. The prop
 * set is chosen by theme — grass tufts/shrooms/rocks on the classic stages,
 * glowing arcane crystals on the Shadow stage, charred magma boulders on the
 * Crimson stage. Purely visual: everything is placed behind blocks/entities and
 * has no physics. Placement is a deterministic hash of the tile position, so a
 * level always decorates identically — across restarts and for every player.
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
function pickDecor(set: readonly DecorProp[], h: number): DecorProp {
  const total = set.reduce((sum, d) => sum + d.weight, 0);
  let roll = h % total;
  for (const d of set) {
    if ((roll -= d.weight) < 0) return d;
  }
  return set[0];
}

/** Decorate all exposed grass-top tiles of the terrain layer. */
export function decorateTerrain(
  scene: Phaser.Scene,
  terrain: Phaser.Tilemaps.TilemapLayer,
  depth: number,
  theme: BgTheme
): void {
  const set = decorSetFor(theme);
  if (set.length === 0) return; // themes may opt out of scatter props entirely
  const map = terrain.tilemap;
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const tile = terrain.getTileAt(tx, ty);
      if (!tile || tile.index !== TileGid.GrassTop) continue;
      const above = terrain.getTileAt(tx, ty - 1);
      if (above && above.index > 0) continue; // buried or under spikes

      const h = hashTile(tx, ty);
      if (h % DENSITY !== 0) continue;

      const d = pickDecor(set, (h >>> 4) % 997);
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
