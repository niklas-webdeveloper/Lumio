import type Phaser from "phaser";

/** Available parallax background themes (one per level). */
export type BgTheme = "mountain" | "desert" | "graveyard" | "snow";

export const BG_THEMES: BgTheme[] = ["mountain", "desert", "graveyard", "snow"];

/** Each theme has 5 depth layers (L0 = far sky … L4 = near foreground). */
export const BG_LAYERS = 5;

/** Texture key for a theme's layer. */
export function bgKey(theme: BgTheme, layer: number): string {
  return `bg_${theme}_${layer}`;
}

/** Queue every theme's layers for loading (call in PreloadScene.preload). */
export function loadBackgrounds(scene: Phaser.Scene): void {
  for (const theme of BG_THEMES) {
    for (let i = 0; i < BG_LAYERS; i++) {
      scene.load.image(bgKey(theme, i), `assets/backgrounds/${theme}/L${i}.png`);
    }
  }
}
