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
