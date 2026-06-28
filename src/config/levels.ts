import level01 from "@/levels/level-01.json";

/**
 * Level manifest — the ordered list of levels the game plays through.
 * To add a level: drop `level-XX.json` in src/levels/, import it here, and add
 * an entry. Order in this array defines progression.
 */
export interface LevelDef {
  /** Unique cache key for the tilemap. */
  key: string;
  /** Display name (shown in HUD / level-complete screen). */
  title: string;
  /** Raw Tiled JSON map data. */
  data: unknown;
}

export const LEVELS: LevelDef[] = [
  { key: "level-01", title: "Sunny Meadows", data: level01 },
];

/** Total number of levels. */
export const LEVEL_COUNT = LEVELS.length;

/** Get a level definition by zero-based index (clamped/undefined-safe). */
export function getLevel(index: number): LevelDef | undefined {
  return LEVELS[index];
}
