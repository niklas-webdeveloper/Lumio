import Phaser from "phaser";
import { createGameConfig } from "@/config/GameConfig";
import { BootScene } from "@/scenes/BootScene";
import { PreloadScene } from "@/scenes/PreloadScene";
import { GameScene } from "@/scenes/GameScene";
import { audioManager } from "@/systems/AudioManager";
import { ui } from "@/ui/UIManager";

/**
 * Entry point. The Phaser game runs only the gameplay (Boot → Preload → Game);
 * all menus, dialogs and the HUD are a crisp DOM/CSS layer (UIManager) overlaid
 * on the canvas. Preload hands off to the UI's home screen.
 */
const config = createGameConfig([BootScene, PreloadScene, GameScene]);

const game = new Phaser.Game(config);
ui.attach(game);

// Browsers block audio until a user gesture — resume the synth on first input.
const unlockAudio = () => audioManager.unlock();
window.addEventListener("keydown", unlockAudio);
window.addEventListener("pointerdown", unlockAudio);

// Expose the game instance during development for debugging / smoke tests.
if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
  (window as unknown as { ui: typeof ui }).ui = ui;
}
