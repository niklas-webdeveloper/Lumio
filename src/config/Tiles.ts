/**
 * Tile GIDs (global ids) for the terrain tileset. These match the order tiles
 * are drawn into the generated tileset texture AND the indices used inside the
 * Tiled level JSON. Tiled is 1-based (0 = empty), so the first tile is GID 1.
 *
 * Keep this in sync with TextureFactory.createTileset().
 */
export const TileGid = {
  GrassTop: 1, // solid — ground surface
  Dirt: 2, // solid — ground/underground fill
  Stone: 3, // solid — platforms / structure
  Brick: 4, // solid — breakable when player is big (Milestone 4)
  Lucky: 5, // solid — "?" block, gives reward (Milestone 4)
  Used: 6, // solid — spent block (Milestone 4)
  Spike: 7, // hazard — damages on touch (Milestone 4)
  Plate: 8, // solid — metal platform variant
} as const;

/** Total number of tiles in the generated tileset (texture grid columns). */
export const TILE_COUNT = 8;

/** Tile GIDs the player physically collides with. */
export const SOLID_TILES: number[] = [
  TileGid.GrassTop,
  TileGid.Dirt,
  TileGid.Stone,
  TileGid.Brick,
  TileGid.Lucky,
  TileGid.Used,
  TileGid.Plate,
];

/** Tile GIDs that deal damage on contact (handled from Milestone 4). */
export const HAZARD_TILES: number[] = [TileGid.Spike];
