import level01 from "@/levels/level-01.json";
import level02 from "@/levels/level-02.json";
import level03 from "@/levels/level-03.json";
import level04 from "@/levels/level-04.json";
import type { BgTheme } from "@/config/backgrounds";

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
  /** Parallax background theme for this level. */
  theme: BgTheme;
  /** Cache key of this level's background music (loaded in PreloadScene). */
  music: string;
  /** Track name shown in the "Now Playing" toast at level start. */
  trackTitle: string;
  /** Artist / source of the track (second line of the toast). */
  trackArtist: string;
  /**
   * Par time in seconds: finishing at or under it earns the speed star and
   * pays the time bonus. Generous enough to also collect every coin en route.
   */
  parTime: number;
  /** Raw Tiled JSON map data. */
  data: unknown;
}

export const LEVELS: LevelDef[] = [
  { key: "level-01", title: "Misty Peaks", theme: "mountain", music: "bgm-1", trackTitle: "Fighting", trackArtist: "Jujutsu Kaisen", parTime: 50, data: level01 },
  { key: "level-02", title: "Scorching Dunes", theme: "desert", music: "bgm-2", trackTitle: "Opening 10", trackArtist: "Black Clover", parTime: 50, data: level02 },
  { key: "level-03", title: "Gloomy Hollow", theme: "graveyard", music: "bgm-3", trackTitle: "Opening 2", trackArtist: "Attack on Titan", parTime: 50, data: level03 },
  { key: "level-04", title: "Frozen Summit", theme: "snow", music: "bgm-4", trackTitle: "Hadouken", trackArtist: "Lupus Nocte", parTime: 50, data: level04 },
];

/** Total number of levels. */
export const LEVEL_COUNT = LEVELS.length;

/** Get a level definition by zero-based index (clamped/undefined-safe). */
export function getLevel(index: number): LevelDef | undefined {
  return LEVELS[index];
}

/** Minimal slice of the Tiled JSON needed to count collectibles. */
interface TiledLevelData {
  layers?: Array<{
    type?: string;
    objects?: Array<{
      type?: string;
      class?: string;
      properties?: Array<{ name: string; value: unknown }>;
    }>;
  }>;
}

const coinCountCache = new Map<string, number>();

/**
 * Total collectible coins in a level: coin spawns plus every Lucky Block whose
 * reward is a coin (missing `reward` defaults to "coin", matching GameScene).
 * Used by the level select to show "collected / total" without loading the map.
 */
export function countLevelCoins(level: LevelDef): number {
  const cached = coinCountCache.get(level.key);
  if (cached !== undefined) return cached;

  let total = 0;
  const data = level.data as TiledLevelData;
  for (const layer of data.layers ?? []) {
    if (layer.type !== "objectgroup") continue;
    for (const obj of layer.objects ?? []) {
      const type = (obj.type || obj.class || "").toLowerCase();
      if (type === "coin") {
        total += 1;
      } else if (type === "luckyblock") {
        const reward = obj.properties?.find((p) => p.name === "reward")?.value;
        if ((reward ?? "coin") === "coin") total += 1;
      }
    }
  }
  coinCountCache.set(level.key, total);
  return total;
}
