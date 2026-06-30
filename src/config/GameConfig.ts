import Phaser from "phaser";

/**
 * Display / world constants.
 *
 * The game is *authored* in a 640×360 "design" coordinate space (all layouts,
 * font sizes, physics and levels use these units). To render crisply on modern
 * high-resolution screens, the actual canvas is rendered at RENDER_SCALE× that
 * (1920×1080) and every camera is zoomed by RENDER_SCALE. This supersamples all
 * shapes and text — razor-sharp UI — without changing any gameplay numbers.
 */
export const GAME_WIDTH = 640; // design width
export const GAME_HEIGHT = 360; // design height
export const TILE_SIZE = 32;

/** Canvas is rendered at this multiple of the design size for crispness. */
export const RENDER_SCALE = 3;
export const CANVAS_WIDTH = GAME_WIDTH * RENDER_SCALE; // 1920
export const CANVAS_HEIGHT = GAME_HEIGHT * RENDER_SCALE; // 1080

/** Modern font stacks (self-hosted; see public/assets/fonts/fonts.css). */
export const Fonts = {
  /** Rounded display font for titles / big numbers. */
  display: "'Fredoka', 'Trebuchet MS', sans-serif",
  /** Clean UI/body font. */
  body: "'Nunito', 'Segoe UI', sans-serif",
} as const;

/** Background color used before a scene draws its own. */
export const BACKGROUND_COLOR = "#0e1726";

/**
 * Point a static scene's camera at the 640×360 design rectangle, rendered at
 * RENDER_SCALE×. Call once in a scene's create(). (The gameplay camera instead
 * follows the player at the same zoom — see CameraManager.)
 */
export function applyDesignViewport(scene: Phaser.Scene): void {
  const cam = scene.cameras.main;
  cam.setZoom(RENDER_SCALE);
  cam.centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
}

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
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    pixelArt: false, // smooth, antialiased rendering (no nearest-neighbor)
    roundPixels: false,
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
      antialias: true,
      antialiasGL: true,
      roundPixels: false,
    },
    fps: {
      target: 60,
      forceSetTimeOut: false,
    },
    scene: scenes,
  };
}
