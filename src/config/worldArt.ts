import Phaser from "phaser";
import { TextureKeys } from "@/config/AssetKeys";

/**
 * Hand-made world art (SunnyLand by Ansimuz, composed by
 * scripts/build-world-art.py). Everything loads under the same TextureKeys the
 * procedural TextureFactory would otherwise generate, so the generators become
 * no-ops and the rest of the game is untouched. Frame geometry below must match
 * the build script's output (it prints the sizes).
 */

/** Animated sprite strips: key, file, frame geometry and animation. */
export const WorldSheet = {
  coin: {
    key: TextureKeys.Coin,
    url: "assets/sprites/coin.png",
    frameWidth: 26,
    frameHeight: 22,
    frames: 5,
  },
  growcap: {
    key: TextureKeys.Growcap,
    url: "assets/sprites/growcap.png",
    frameWidth: 19,
    frameHeight: 16,
    frames: 7,
  },
  plodder: {
    key: TextureKeys.Plodder,
    url: "assets/sprites/plodder.png",
    frameWidth: 35,
    frameHeight: 26,
    frames: 6,
  },
  snapvine: {
    key: TextureKeys.Snapvine,
    url: "assets/sprites/snapvine.png",
    frameWidth: 25,
    frameHeight: 21,
    frames: 8,
  },
  vulture: {
    key: TextureKeys.Vulture,
    url: "assets/sprites/vulture.png",
    frameWidth: 29,
    frameHeight: 30,
    frames: 4,
  },
  batHang: {
    key: TextureKeys.BatHang,
    url: "assets/sprites/bat-hang.png",
    frameWidth: 20,
    frameHeight: 52,
    frames: 4,
  },
  batFly: {
    key: TextureKeys.BatFly,
    url: "assets/sprites/bat-fly.png",
    frameWidth: 46,
    frameHeight: 53,
    frames: 3,
  },
} as const;

/** Animation keys for the world sprite strips. */
export const WorldAnim = {
  coinSpin: "coin-spin",
  growcapIdle: "growcap-idle",
  plodderWalk: "plodder-walk",
  snapvineIdle: "snapvine-idle",
  vultureFly: "vulture-fly",
  batHang: "bat-hang",
  batFly: "bat-fly",
} as const;

/** Single-image world art loaded under existing TextureKeys. */
const WorldImages = [
  { key: TextureKeys.Tiles, url: "assets/tilesets/terrain.png" },
  { key: TextureKeys.LuckyBlock, url: "assets/sprites/blocks/lucky.png" },
  { key: TextureKeys.Brick, url: "assets/sprites/blocks/brick.png" },
  { key: TextureKeys.UsedBlock, url: "assets/sprites/blocks/used.png" },
  { key: TextureKeys.Icicle, url: "assets/sprites/icicle.png" },
] as const;

/** Non-colliding props scattered on grass tiles (see systems/Decor.ts). */
export const DecorArt = [
  { key: "decor_tuft_a", url: "assets/sprites/decor/tuft-a.png", scale: 2, weight: 4 },
  { key: "decor_tuft_b", url: "assets/sprites/decor/tuft-b.png", scale: 2, weight: 4 },
  { key: "decor_shrooms", url: "assets/sprites/decor/shrooms.png", scale: 2, weight: 2 },
  { key: "decor_rock", url: "assets/sprites/decor/rock.png", scale: 1.5, weight: 2 },
  { key: "decor_bush", url: "assets/sprites/decor/bush.png", scale: 1.5, weight: 1 },
] as const;

/** Queue all world art for loading (call in PreloadScene.preload). */
export function loadWorldArt(scene: Phaser.Scene): void {
  for (const img of WorldImages) scene.load.image(img.key, img.url);
  for (const d of DecorArt) scene.load.image(d.key, d.url);
  for (const s of Object.values(WorldSheet)) {
    scene.load.spritesheet(s.key, s.url, {
      frameWidth: s.frameWidth,
      frameHeight: s.frameHeight,
    });
  }
}

/**
 * Post-load setup: crisp nearest-neighbour sampling for all pixel art, then
 * the strip animations. Call once in PreloadScene.create, before the
 * TextureFactory fallback generators run.
 */
export function setupWorldArt(scene: Phaser.Scene): void {
  const pixelKeys: string[] = [
    ...WorldImages.map((i) => i.key),
    ...DecorArt.map((d) => d.key),
    ...Object.values(WorldSheet).map((s) => s.key),
  ];
  for (const key of pixelKeys) {
    if (scene.textures.exists(key)) {
      scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  const loop = (key: string, sheet: { key: string; frames: number }, frameRate: number) => {
    if (scene.anims.exists(key) || !scene.textures.exists(sheet.key)) return;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(sheet.key, {
        start: 0,
        end: sheet.frames - 1,
      }),
      frameRate,
      repeat: -1,
    });
  };
  loop(WorldAnim.coinSpin, WorldSheet.coin, 9);
  loop(WorldAnim.growcapIdle, WorldSheet.growcap, 10);
  loop(WorldAnim.plodderWalk, WorldSheet.plodder, 10);
  loop(WorldAnim.snapvineIdle, WorldSheet.snapvine, 8);
  loop(WorldAnim.vultureFly, WorldSheet.vulture, 8);
  loop(WorldAnim.batHang, WorldSheet.batHang, 4); // slow, sleepy sway
  loop(WorldAnim.batFly, WorldSheet.batFly, 10);
}
