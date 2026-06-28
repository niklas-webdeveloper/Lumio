import Phaser from "phaser";

/**
 * Generates simple solid-color player textures at runtime so movement could be
 * built and tuned before character art exists. These are replaced by a proper
 * animated sprite in the art pass; nothing depends on these visuals.
 *
 * (Terrain is drawn by TextureFactory; level geometry uses the tilemap.)
 */
export const PlaceholderKeys = {
  PlayerSmall: "ph_player_small",
  PlayerBig: "ph_player_big",
} as const;

/** Create a flat-colored rectangle texture with a subtle border for contrast. */
function makeRect(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  fill: number,
  border = 0x000000
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(fill, 1);
  g.fillRect(0, 0, width, height);
  g.lineStyle(2, border, 0.35);
  g.strokeRect(1, 1, width - 2, height - 2);
  g.generateTexture(key, width, height);
  g.destroy();
}

/** Register placeholder player textures for the given scene. */
export function createPlaceholderTextures(scene: Phaser.Scene): void {
  makeRect(scene, PlaceholderKeys.PlayerSmall, 22, 30, 0x6ad7ff);
  makeRect(scene, PlaceholderKeys.PlayerBig, 26, 46, 0x4ab3e0);
}
