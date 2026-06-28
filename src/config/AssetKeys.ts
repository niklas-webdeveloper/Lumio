/**
 * Typed asset keys — single source of truth for every string used to load or
 * reference an asset. Keeps the codebase free of magic strings and makes it
 * obvious what exists. Populated as milestones add assets.
 */
export const SceneKeys = {
  Boot: "BootScene",
  Preload: "PreloadScene",
  Menu: "MenuScene",
  Game: "GameScene",
  UI: "UIScene",
  Pause: "PauseScene",
  LevelComplete: "LevelCompleteScene",
  GameOver: "GameOverScene",
} as const;

export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];

/**
 * Texture keys for procedurally generated art (TextureFactory) and, later,
 * any loaded image assets. To swap in your own art, register an image under
 * the same key in PreloadScene instead of generating it — nothing else changes.
 */
export const TextureKeys = {
  Tiles: "tex_tiles", // terrain tileset (grid of 32px tiles)
  Sky: "tex_sky", // parallax: static gradient sky
  HillsFar: "tex_hills_far", // parallax: distant hills (tiled)
  HillsNear: "tex_hills_near", // parallax: closer hills (tiled)
  Beacon: "tex_beacon", // level-end goal marker
} as const;

