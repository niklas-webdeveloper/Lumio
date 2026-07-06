import Phaser from "phaser";
import { TextureKeys, EnemyAnim } from "@/config/AssetKeys";
import { DecorArt } from "@/config/worldArt";
import type { BgTheme } from "@/config/backgrounds";

/**
 * Theme-specific art for the two anime stages (levels 5 & 6). Keeps everything
 * that reskins a level by its `theme` in one place:
 *   - a per-theme terrain tileset (same 10-GID layout as the shared one, so the
 *     level JSON is untouched — LevelLoader just swaps the tileset texture);
 *   - the themed enemies (built by scripts/build-themed-enemies.py);
 *   - the themed ground-scatter decoration (build-themed-decor.py).
 *
 * Everything loads under its own key; the base game (levels 1-4) is untouched.
 */

/** One scattered ground prop (shape matches worldArt.DecorArt entries). */
export interface DecorProp {
  key: string;
  url: string;
  scale: number;
  weight: number;
}

/** Frame geometry of the themed enemy strips (must match the build script). */
const SHADOW_SOLDIER_FRAME = { w: 59, h: 54, frames: 2 };
const PHOENIX_FRAME = { w: 69, h: 60, frames: 18 };

/** Themed ground-scatter props, keyed by theme. The Shadow stage deliberately
 * runs no scatter props (its arcane tiles carry the look on their own). */
const CRIMSON_DECOR: DecorProp[] = [
  { key: "decor_crimson_rock_a", url: "assets/sprites/decor/crimson/rock-a.png", scale: 1, weight: 4 },
  { key: "decor_crimson_rock_b", url: "assets/sprites/decor/crimson/rock-b.png", scale: 1, weight: 3 },
];

/** Palette for a themed pipe: [base, mid, highlight, shade, rim-glow]. */
const PIPE_PALETTES: Partial<Record<BgTheme, [number, number, number, number, number]>> = {
  shadow: [0x1b2340, 0x2c3a63, 0x5369ad, 0x141a30, 0x5cc6ff],
  crimson: [0x181210, 0x2c211c, 0x50392c, 0x0f0b09, 0xff7a1e],
};

/** The themed pipe texture key for a theme (falls back to the shared pipe). */
export function pipeKeyFor(theme: BgTheme): string {
  if (theme === "shadow") return TextureKeys.PipeShadow;
  if (theme === "crimson") return TextureKeys.PipeCrimson;
  return TextureKeys.Pipe;
}

/** A tint that pulls the green plant into the theme (undefined = leave as-is).
 * Strong/dark casts — the plant art is green-dominant, so a light tint barely
 * shifts it; these darken it into a shadow/cursed lurker instead. */
export function snapvineTintFor(theme: BgTheme): number | undefined {
  if (theme === "shadow") return 0x333d82; // deep arcane indigo (darker)
  if (theme === "crimson") return 0x8a3418; // charred ember (darker)
  return undefined;
}

/** A tint for the wooden brick crate so it blends into the theme (light-toned
 * art takes a tint cleanly, unlike the green plant). */
export function brickTintFor(theme: BgTheme): number | undefined {
  if (theme === "shadow") return 0x8ea6dc; // cool arcane stone
  if (theme === "crimson") return 0xd07a44; // scorched rock
  return undefined;
}

/** Draw one themed pipe (64×80) — mirrors TextureFactory.createPipe geometry. */
function paintThemedPipe(
  g: Phaser.GameObjects.Graphics,
  pal: [number, number, number, number, number]
): void {
  const w = 64;
  const h = 80;
  const [base, mid, hi, shade, glow] = pal;
  const rect = (x: number, y: number, rw: number, rh: number, c: number) => {
    g.fillStyle(c, 1);
    g.fillRect(x, y, rw, rh);
  };
  // shaft
  rect(4, 16, w - 8, h - 16, base);
  rect(8, 16, w - 16, h - 16, mid);
  rect(10, 16, 10, h - 16, hi);
  rect(w - 16, 16, 8, h - 16, shade);
  // a faint glowing seam down the shaft
  rect(w / 2 - 1, 18, 2, h - 20, glow);
  // rim
  rect(0, 0, w, 18, shade);
  rect(0, 0, w, 16, mid);
  rect(4, 0, 10, 16, hi);
  rect(w - 12, 0, 10, 16, shade);
  rect(0, 0, w, 2, glow); // bright rim sheen (themed glow)
  rect(0, 15, w, 3, base);
  // hollow mouth
  rect(8, 3, w - 16, 13, 0x05070d);
  rect(10, 4, w - 20, 11, 0x0c1018);
}

/** Generate the themed pipe textures (idempotent). Call in setup. */
function createThemedPipes(scene: Phaser.Scene): void {
  const gen = (key: string, theme: BgTheme) => {
    if (scene.textures.exists(key)) return;
    const pal = PIPE_PALETTES[theme]!;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    paintThemedPipe(g, pal);
    g.generateTexture(key, 64, 80);
    g.destroy();
  };
  gen(TextureKeys.PipeShadow, "shadow");
  gen(TextureKeys.PipeCrimson, "crimson");
}

/** The terrain tileset texture key for a theme (falls back to the shared one). */
export function terrainKeyFor(theme: BgTheme): string {
  if (theme === "shadow") return TextureKeys.TilesShadow;
  if (theme === "crimson") return TextureKeys.TilesCrimson;
  return TextureKeys.Tiles;
}

/** The ground-scatter decoration set for a theme (default = worldArt foliage). */
export function decorSetFor(theme: BgTheme): readonly DecorProp[] {
  if (theme === "shadow") return []; // no scatter props on the Shadow stage
  if (theme === "crimson") return CRIMSON_DECOR;
  return DecorArt as readonly DecorProp[];
}

/** Every themed decor prop, for preloading. */
const ALL_THEMED_DECOR = [...CRIMSON_DECOR];

/** Queue themed tilesets, enemies and decor for loading (call in preload). */
export function loadThemedArt(scene: Phaser.Scene): void {
  scene.load.image(TextureKeys.TilesShadow, "assets/tilesets/terrain-shadow.png");
  scene.load.image(TextureKeys.TilesCrimson, "assets/tilesets/terrain-crimson.png");

  scene.load.spritesheet(
    TextureKeys.ShadowSoldier,
    "assets/sprites/enemies/shadow-soldier.png",
    { frameWidth: SHADOW_SOLDIER_FRAME.w, frameHeight: SHADOW_SOLDIER_FRAME.h }
  );
  scene.load.image(TextureKeys.LavaGolem, "assets/sprites/enemies/lava-golem.png");
  scene.load.spritesheet(
    TextureKeys.Phoenix,
    "assets/sprites/enemies/phoenix.png",
    { frameWidth: PHOENIX_FRAME.w, frameHeight: PHOENIX_FRAME.h }
  );

  for (const d of ALL_THEMED_DECOR) scene.load.image(d.key, d.url);
}

/**
 * Post-load setup: crisp NEAREST sampling for the pixel-crisp tiles/soldier,
 * and register the Shadow-Soldier march animation. Call in PreloadScene.create.
 */
export function setupThemedArt(scene: Phaser.Scene): void {
  createThemedPipes(scene); // arcane / obsidian pipe reskins

  // Tilesets and the pixel-art soldier/phoenix stay crisp; the painted golem
  // keeps the game's default smooth sampling.
  const nearest = [
    TextureKeys.TilesShadow,
    TextureKeys.TilesCrimson,
    TextureKeys.ShadowSoldier,
    TextureKeys.Phoenix,
  ];
  for (const key of nearest) {
    if (scene.textures.exists(key)) {
      scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  if (
    !scene.anims.exists(EnemyAnim.shadowSoldierMarch) &&
    scene.textures.exists(TextureKeys.ShadowSoldier)
  ) {
    scene.anims.create({
      key: EnemyAnim.shadowSoldierMarch,
      frames: scene.anims.generateFrameNumbers(TextureKeys.ShadowSoldier, {
        start: 0,
        end: SHADOW_SOLDIER_FRAME.frames - 1,
      }),
      frameRate: 3, // slow, deliberate blade brandish
      repeat: -1,
    });
  }

  if (
    !scene.anims.exists(EnemyAnim.phoenixFly) &&
    scene.textures.exists(TextureKeys.Phoenix)
  ) {
    scene.anims.create({
      key: EnemyAnim.phoenixFly,
      frames: scene.anims.generateFrameNumbers(TextureKeys.Phoenix, {
        start: 0,
        end: PHOENIX_FRAME.frames - 1,
      }),
      frameRate: 18,
      repeat: -1,
    });
  }
}
