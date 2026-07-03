import Phaser from "phaser";
import { TextureKeys } from "@/config/AssetKeys";
import { SOLID_TILES, HAZARD_TILES } from "@/config/Tiles";
import type { LevelDef } from "@/config/levels";

/** A single entity-spawn entry parsed from the level's object layer. */
export interface SpawnObject {
  type: string; // entity kind: "player", "beacon", "coin", "plodder", …
  name: string;
  x: number;
  y: number;
  properties: Record<string, unknown>;
}

/** Everything GameScene needs after a level is built. */
export interface LoadedLevel {
  map: Phaser.Tilemaps.Tilemap;
  terrain: Phaser.Tilemaps.TilemapLayer;
  widthPx: number;
  heightPx: number;
  playerSpawn: Phaser.Math.Vector2;
  /** All object-layer spawns except the player (instantiated by GameScene). */
  spawns: SpawnObject[];
}

const TERRAIN_LAYER = "terrain";
const SPAWN_LAYER = "spawns";
const TILESET_NAME = "terrain"; // must match the tileset name inside the JSON
/**
 * The shipped tileset image (public/assets/tilesets/terrain.png) is extruded:
 * every 32px tile carries a 2px border of repeated edge pixels so nothing
 * bleeds at tile seams. Phaser reads that layout as margin 2 / spacing 4.
 */
const TILESET_MARGIN = 2;
const TILESET_SPACING = 4;

/**
 * Builds a playable level from a Tiled JSON definition:
 *  - injects the JSON into Phaser's tilemap cache
 *  - creates the terrain layer using the generated tileset texture
 *  - sets tile collision (solid + hazard)
 *  - parses the object layer into typed spawn entries
 *
 * Returns references so the scene can wire physics, camera and entities.
 */
export class LevelLoader {
  load(scene: Phaser.Scene, level: LevelDef): LoadedLevel {
    // Register the map JSON under its key (idempotent across scene restarts).
    if (!scene.cache.tilemap.exists(level.key)) {
      scene.cache.tilemap.add(level.key, {
        format: Phaser.Tilemaps.Formats.TILED_JSON,
        data: level.data,
      });
    }

    const map = scene.make.tilemap({ key: level.key });
    const tileset = map.addTilesetImage(
      TILESET_NAME,
      TextureKeys.Tiles,
      32,
      32,
      TILESET_MARGIN,
      TILESET_SPACING
    );
    if (!tileset) {
      throw new Error(`Failed to add tileset "${TILESET_NAME}" for ${level.key}`);
    }

    const terrain = map.createLayer(TERRAIN_LAYER, tileset, 0, 0);
    if (!terrain) {
      throw new Error(`Level ${level.key} is missing a "${TERRAIN_LAYER}" layer`);
    }
    terrain.setCollision([...SOLID_TILES, ...HAZARD_TILES]);

    const playerSpawn = new Phaser.Math.Vector2(64, 64);
    const spawns: SpawnObject[] = [];

    const objectLayer = map.getObjectLayer(SPAWN_LAYER);
    for (const obj of objectLayer?.objects ?? []) {
      const type = (obj.type || obj.name || "").toLowerCase();
      const x = obj.x ?? 0;
      const y = obj.y ?? 0;
      if (type === "player") {
        playerSpawn.set(x, y);
        continue;
      }
      spawns.push({
        type,
        name: obj.name ?? "",
        x,
        y,
        properties: this.readProperties(obj),
      });
    }

    return {
      map,
      terrain,
      widthPx: map.widthInPixels,
      heightPx: map.heightInPixels,
      playerSpawn,
      spawns,
    };
  }

  /** Flatten Tiled's [{name,value}] property array into a plain record. */
  private readProperties(
    obj: Phaser.Types.Tilemaps.TiledObject
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const props = obj.properties as
      | Array<{ name: string; value: unknown }>
      | undefined;
    for (const p of props ?? []) out[p.name] = p.value;
    return out;
  }
}
