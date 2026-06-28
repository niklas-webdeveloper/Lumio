import Phaser from "phaser";

/**
 * Centralized display / world constants.
 * Base resolution is a 16:9 retro frame that scales crisply to any window
 * (640x360 × 3 = 1920x1080). Tiles are 32px in world space.
 */
export const GAME_WIDTH = 640;
export const GAME_HEIGHT = 360;
export const TILE_SIZE = 32;

/** Background color used before a scene draws its own (GitHub-dark). */
export const BACKGROUND_COLOR = "#1a1c2c";

/**
 * Builds the Phaser game config. Scenes are injected by the caller so this
 * module stays free of scene import cycles.
 */
export function createGameConfig(
  scenes: Phaser.Types.Scenes.SceneType[]
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: "game-root",
    backgroundColor: BACKGROUND_COLOR,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    pixelArt: true, // nearest-neighbor scaling -> crisp pixel art
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 }, // per-entity gravity is set in PhysicsConfig
        debug: false,
      },
    },
    render: {
      antialias: false,
    },
    fps: {
      target: 60,
      forceSetTimeOut: false,
    },
    scene: scenes,
  };
}
