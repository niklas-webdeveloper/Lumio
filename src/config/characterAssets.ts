import type Phaser from "phaser";
// Character art by Kibyra (https://kibyra.itch.io) — see character/license.txt.
// Imported from the project's `character/` folder; Vite bundles & hashes them.
import idleUrl from "../../character/idle/idle.png";
import runUrl from "../../character/running/running.png";
import jumpUrl from "../../character/jumping/jump.png";
import fallUrl from "../../character/falling/fall.png";
import landUrl from "../../character/landing/land.png";
import dashUrl from "../../character/dashing/dash.png";
import runJumpUrl from "../../character/runningjump/runningjump.png";
import portraitUrl from "../../character/character.png";

/** All sheets use a uniform 128×128 frame; Phaser slices them row-major. */
export const HERO_FRAME = 128;

/** Sprite-sheet definitions: load key, source URL, and frame count. */
export const HeroSheet = {
  idle: { key: "hero_idle", url: idleUrl, frames: 7 },
  run: { key: "hero_run", url: runUrl, frames: 12 },
  jump: { key: "hero_jump", url: jumpUrl, frames: 13 },
  fall: { key: "hero_fall", url: fallUrl, frames: 9 },
  land: { key: "hero_land", url: landUrl, frames: 8 },
  dash: { key: "hero_dash", url: dashUrl, frames: 5 },
  runjump: { key: "hero_runjump", url: runJumpUrl, frames: 7 },
} as const;

/** Standalone portrait (used on the home screen). */
export const HeroPortrait = { key: "hero_portrait", url: portraitUrl } as const;

/** Animation keys created from the sheets. */
export const HeroAnim = {
  idle: "hero-idle",
  run: "hero-run",
  jump: "hero-jump",
  fall: "hero-fall",
  land: "hero-land",
  dash: "hero-dash",
  runjump: "hero-runjump",
} as const;

/** Queue all character sprite sheets + portrait for loading (call in preload). */
export function loadHeroAssets(scene: Phaser.Scene): void {
  const cfg = { frameWidth: HERO_FRAME, frameHeight: HERO_FRAME };
  for (const s of Object.values(HeroSheet)) {
    scene.load.spritesheet(s.key, s.url, cfg);
  }
  scene.load.image(HeroPortrait.key, HeroPortrait.url);
}

/** Register the character's animations (global; call once after loading). */
export function registerHeroAnimations(scene: Phaser.Scene): void {
  const def = (
    key: string,
    sheet: { key: string; frames: number },
    frameRate: number,
    repeat: number
  ) => {
    if (scene.anims.exists(key)) return;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(sheet.key, {
        start: 0,
        end: sheet.frames - 1,
      }),
      frameRate,
      repeat,
    });
  };
  def(HeroAnim.idle, HeroSheet.idle, 8, -1);
  def(HeroAnim.run, HeroSheet.run, 18, -1);
  def(HeroAnim.dash, HeroSheet.dash, 16, -1);
  def(HeroAnim.fall, HeroSheet.fall, 12, -1);
  def(HeroAnim.jump, HeroSheet.jump, 20, 0); // play once, hold last frame
  def(HeroAnim.runjump, HeroSheet.runjump, 18, 0);
  def(HeroAnim.land, HeroSheet.land, 24, 0);
}
