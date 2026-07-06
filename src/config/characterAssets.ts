import Phaser from "phaser";
// Lumio art by Kibyra (https://kibyra.itch.io) — see character/license.txt.
// Imported from the project's `character/` folder; Vite bundles & hashes them.
import lumioIdleUrl from "../../character/idle/idle.png";
import lumioRunUrl from "../../character/running/running.png";
import lumioJumpUrl from "../../character/jumping/jump.png";
import lumioFallUrl from "../../character/falling/fall.png";
import lumioLandUrl from "../../character/landing/land.png";
import lumioDashUrl from "../../character/dashing/dash.png";
import lumioRunJumpUrl from "../../character/runningjump/runningjump.png";
import lumioPortraitUrl from "../../character/character.png";
// Foxy art from the SunnyLand pack (Ansimuz) — sheets generated into
// `character-fox/` by scripts/build-fox-character.py (same 128px cell layout
// as Lumio, so both characters share the Player's physics tuning untouched).
import foxIdleUrl from "../../character-fox/idle.png";
import foxRunUrl from "../../character-fox/run.png";
import foxJumpUrl from "../../character-fox/jump.png";
import foxFallUrl from "../../character-fox/fall.png";
import foxLandUrl from "../../character-fox/land.png";
import foxRunJumpUrl from "../../character-fox/runjump.png";
import foxClimbUrl from "../../character-fox/climb.png";
import foxPortraitUrl from "../../character-fox/portrait.png";
// Jin-Woo pixel art by Soulfire (Solo Leveling fan sheet) — sheets generated
// into `character-jinwoo/` by scripts/build-jinwoo-character.py (same 128px
// cell layout, feet on y=120, facing right unflipped).
import jinwooIdleUrl from "../../character-jinwoo/idle.png";
import jinwooRunUrl from "../../character-jinwoo/run.png";
import jinwooJumpUrl from "../../character-jinwoo/jump.png";
import jinwooFallUrl from "../../character-jinwoo/fall.png";
import jinwooLandUrl from "../../character-jinwoo/land.png";
import jinwooRunJumpUrl from "../../character-jinwoo/runjump.png";
import jinwooPortraitUrl from "../../character-jinwoo/portrait.png";

/** All sheets use a uniform 128×128 frame; Phaser slices them row-major. */
export const HERO_FRAME = 128;

export type CharacterId = "lumio" | "fox" | "jinwoo";

/** Sprite-sheet definition: load key, source URL, and frame count. */
interface SheetDef {
  key: string;
  url: string;
  frames: number;
}

/** The animation slots every playable character must fill. */
type AnimSlot = "idle" | "run" | "jump" | "fall" | "land" | "dash" | "runjump";

export interface CharacterDef {
  id: CharacterId;
  name: string;
  /** One-liner shown on the shop card. */
  tagline: string;
  /** Shop price in account coins (0 = starter character). */
  price: number;
  /** Nearest-neighbor filtering for crisp upscaled pixel art. */
  pixelArt: boolean;
  portrait: { key: string; url: string };
  /** Sheets per animation slot (slots may share one sheet, e.g. dash = run). */
  sheets: Record<AnimSlot, SheetDef>;
  /** Extra sheets used for static poses only (no animation slot). */
  extraSheets: SheetDef[];
  /** Animation keys per slot (registered globally in registerHeroAnimations). */
  anims: Record<AnimSlot, string>;
  frameRates: Record<AnimSlot, number>;
  /** Static pose while gripping the level-end flag pole. */
  poleGrab: { key: string; frame: number };
  /** Static pose for the little hop off the pole. */
  poleHop: { key: string; frame: number };
}

const animKeys = (id: CharacterId): Record<AnimSlot, string> => ({
  idle: `${id}-idle`,
  run: `${id}-run`,
  jump: `${id}-jump`,
  fall: `${id}-fall`,
  land: `${id}-land`,
  dash: `${id}-dash`,
  runjump: `${id}-runjump`,
});

const lumioSheets: Record<AnimSlot, SheetDef> = {
  idle: { key: "hero_idle", url: lumioIdleUrl, frames: 7 },
  run: { key: "hero_run", url: lumioRunUrl, frames: 12 },
  jump: { key: "hero_jump", url: lumioJumpUrl, frames: 13 },
  fall: { key: "hero_fall", url: lumioFallUrl, frames: 9 },
  land: { key: "hero_land", url: lumioLandUrl, frames: 8 },
  dash: { key: "hero_dash", url: lumioDashUrl, frames: 5 },
  runjump: { key: "hero_runjump", url: lumioRunJumpUrl, frames: 7 },
};

const foxRunSheet: SheetDef = { key: "fox_run", url: foxRunUrl, frames: 6 };
const foxSheets: Record<AnimSlot, SheetDef> = {
  idle: { key: "fox_idle", url: foxIdleUrl, frames: 4 },
  run: foxRunSheet,
  jump: { key: "fox_jump", url: foxJumpUrl, frames: 1 },
  fall: { key: "fox_fall", url: foxFallUrl, frames: 1 },
  land: { key: "fox_land", url: foxLandUrl, frames: 2 },
  dash: foxRunSheet, // no dedicated dash art — the run cycle at a higher rate
  runjump: { key: "fox_runjump", url: foxRunJumpUrl, frames: 2 },
};

const jinwooRunSheet: SheetDef = { key: "jinwoo_run", url: jinwooRunUrl, frames: 8 };
const jinwooSheets: Record<AnimSlot, SheetDef> = {
  idle: { key: "jinwoo_idle", url: jinwooIdleUrl, frames: 5 },
  run: jinwooRunSheet,
  jump: { key: "jinwoo_jump", url: jinwooJumpUrl, frames: 2 },
  fall: { key: "jinwoo_fall", url: jinwooFallUrl, frames: 2 },
  land: { key: "jinwoo_land", url: jinwooLandUrl, frames: 2 },
  dash: jinwooRunSheet, // no dedicated dash art — the run cycle at a higher rate
  runjump: { key: "jinwoo_runjump", url: jinwooRunJumpUrl, frames: 4 },
};

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  lumio: {
    id: "lumio",
    name: "Lumio",
    tagline: "Der strahlende Held der ersten Stunde.",
    price: 0,
    pixelArt: false,
    portrait: { key: "hero_portrait", url: lumioPortraitUrl },
    sheets: lumioSheets,
    extraSheets: [],
    anims: animKeys("lumio"),
    frameRates: { idle: 8, run: 18, jump: 20, fall: 12, land: 24, dash: 16, runjump: 18 },
    poleGrab: { key: lumioSheets.jump.key, frame: 4 },
    poleHop: { key: lumioSheets.jump.key, frame: 6 },
  },
  fox: {
    id: "fox",
    name: "Foxy",
    tagline: "Der flinke Fuchs aus dem Sonnenwald.",
    price: 150,
    pixelArt: true,
    portrait: { key: "fox_portrait", url: foxPortraitUrl },
    sheets: foxSheets,
    extraSheets: [{ key: "fox_climb", url: foxClimbUrl, frames: 3 }],
    anims: animKeys("fox"),
    frameRates: { idle: 6, run: 14, jump: 10, fall: 10, land: 16, dash: 20, runjump: 8 },
    poleGrab: { key: "fox_climb", frame: 1 },
    poleHop: { key: "fox_jump", frame: 0 },
  },
  jinwoo: {
    id: "jinwoo",
    name: "Jin-Woo",
    tagline: "Der Schattenmonarch — vom E-Rang zur Legende.",
    price: 300,
    pixelArt: true,
    portrait: { key: "jinwoo_portrait", url: jinwooPortraitUrl },
    sheets: jinwooSheets,
    extraSheets: [],
    anims: animKeys("jinwoo"),
    frameRates: { idle: 6, run: 14, jump: 12, fall: 8, land: 14, dash: 20, runjump: 12 },
    poleGrab: { key: jinwooSheets.idle.key, frame: 0 },
    poleHop: { key: jinwooSheets.jump.key, frame: 0 },
  },
};

export const CHARACTER_LIST: CharacterDef[] = Object.values(CHARACTERS);

/** Queue every character's sprite sheets + portraits for loading (call in preload). */
export function loadHeroAssets(scene: Phaser.Scene): void {
  const cfg = { frameWidth: HERO_FRAME, frameHeight: HERO_FRAME };
  const queued = new Set<string>();
  for (const char of CHARACTER_LIST) {
    for (const s of [...Object.values(char.sheets), ...char.extraSheets]) {
      if (queued.has(s.key)) continue; // slots may share a sheet (fox dash=run)
      queued.add(s.key);
      scene.load.spritesheet(s.key, s.url, cfg);
    }
    scene.load.image(char.portrait.key, char.portrait.url);
  }
}

/** Register every character's animations (global; call once after loading). */
export function registerHeroAnimations(scene: Phaser.Scene): void {
  for (const char of CHARACTER_LIST) {
    // Pixel-art characters keep hard pixels when scaled (no bilinear smear).
    if (char.pixelArt) {
      for (const s of [...Object.values(char.sheets), ...char.extraSheets]) {
        scene.textures.get(s.key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
    for (const slot of Object.keys(char.anims) as AnimSlot[]) {
      const key = char.anims[slot];
      if (scene.anims.exists(key)) continue;
      // jump / runjump / land play once and hold; the rest loop.
      const repeat = slot === "jump" || slot === "runjump" || slot === "land" ? 0 : -1;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(char.sheets[slot].key, {
          start: 0,
          end: char.sheets[slot].frames - 1,
        }),
        frameRate: char.frameRates[slot],
        repeat,
      });
    }
  }
}
