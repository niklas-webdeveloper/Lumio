import Phaser from "phaser";
import { createGameConfig } from "@/config/GameConfig";
import { BootScene } from "@/scenes/BootScene";
import { PreloadScene } from "@/scenes/PreloadScene";
import { GameScene } from "@/scenes/GameScene";

/**
 * Entry point. Assembles the scene list and boots the Phaser game.
 * Scene order here defines load order; the active scene is driven by
 * scene.start() transitions, beginning at BootScene.
 */
const config = createGameConfig([BootScene, PreloadScene, GameScene]);

const game = new Phaser.Game(config);

// Expose the game instance during development for debugging / smoke tests.
// Stripped from production builds via the import.meta.env.DEV guard.
if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}
