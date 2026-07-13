import level01 from "@/levels/level-01.json";
import level02 from "@/levels/level-02.json";
import level03 from "@/levels/level-03.json";
import level04 from "@/levels/level-04.json";
import level05 from "@/levels/level-05.json";
import level06 from "@/levels/level-06.json";
import level07 from "@/levels/level-07.json";
import level08 from "@/levels/level-08.json";
import level09 from "@/levels/level-09.json";
import type { BgTheme } from "@/config/backgrounds";

/**
 * Rough level length class. "short" is the classic ~130-tile stage; "medium"
 * is noticeably longer (~200 tiles) but not a slog. "boss" is a sealed arena
 * stage: no coins, no goal pole — defeating the boss ends the level. The
 * level select groups levels by distance, and the marathon only runs the
 * short stages (so boss stages never enter the marathon).
 */
export type LevelDistance = "short" | "medium" | "boss";

/** The bosses that exist (selects the entity class in GameScene). */
export type BossId = "monarch" | "kraken";

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
  /** Cache key of this level's background music (loaded in PreloadScene).
   *  Empty string = no soundtrack yet; the level runs silent. */
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
  /** Length class (groups the level select; the marathon runs "short" only). */
  distance: LevelDistance;
  /** Boss stages only: which boss guards this arena. */
  boss?: BossId;
  /** Raw Tiled JSON map data. */
  data: unknown;
}

export const LEVELS: LevelDef[] = [
  { key: "level-01", title: "Misty Peaks", theme: "mountain", music: "bgm-1", trackTitle: "Fighting", trackArtist: "Jujutsu Kaisen", parTime: 50, distance: "short", data: level01 },
  { key: "level-02", title: "Scorching Dunes", theme: "desert", music: "bgm-2", trackTitle: "Opening 10", trackArtist: "Black Clover", parTime: 50, distance: "short", data: level02 },
  { key: "level-03", title: "Gloomy Hollow", theme: "graveyard", music: "bgm-3", trackTitle: "Opening 2", trackArtist: "Attack on Titan", parTime: 50, distance: "short", data: level03 },
  { key: "level-04", title: "Frozen Summit", theme: "snow", music: "bgm-4", trackTitle: "Hadouken", trackArtist: "Lupus Nocte", parTime: 50, distance: "short", data: level04 },
  { key: "level-05", title: "Shadow Monarch", theme: "shadow", music: "bgm-5", trackTitle: "LEveL", trackArtist: "Solo Leveling", parTime: 85, distance: "medium", data: level05 },
  { key: "level-06", title: "Crimson Shibuya", theme: "crimson", music: "bgm-6", trackTitle: "SPECIALZ", trackArtist: "Jujutsu Kaisen", parTime: 85, distance: "medium", data: level06 },
  { key: "level-07", title: "Tropic Lagoon", theme: "lagoon", music: "bgm-7", trackTitle: "LEveL", trackArtist: "Solo Leveling", parTime: 90, distance: "medium", data: level07 },
  // Boss stages: the endgame gauntlet after the world tour. Par times are the
  // speed-star goal for the whole fight; the coin star is replaced by the
  // "no damage" star (arenas have no coins).
  { key: "level-08", title: "Monarchs Thron", theme: "shadow", music: "bgm-5", trackTitle: "LEveL", trackArtist: "Solo Leveling", parTime: 75, distance: "boss", boss: "monarch", data: level08 },
  { key: "level-09", title: "Krakenbucht", theme: "lagoon", music: "bgm-7", trackTitle: "LEveL", trackArtist: "Solo Leveling", parTime: 75, distance: "boss", boss: "kraken", data: level09 },
];

/** Total number of levels. */
export const LEVEL_COUNT = LEVELS.length;

/**
 * The marathon runs the short-distance stages back to back (they come first
 * in the manifest, so indices 0..MARATHON_LEVEL_COUNT-1 are the run).
 */
export const MARATHON_LEVEL_COUNT = LEVELS.filter(
  (l) => l.distance === "short"
).length;

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
 * Total collectible coins in a level: fixed coin spawns only. "?" blocks roll
 * a random reward now, so their coins are a bonus and no longer part of the
 * "all coins" star goal (this lowered every level's requirement by 2).
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
      if (type === "coin") total += 1;
    }
  }
  coinCountCache.set(level.key, total);
  return total;
}
