import Phaser from "phaser";
import { TextureKeys, EnemyAnim } from "@/config/AssetKeys";
import type { BossId } from "@/config/levels";

/**
 * Boss-stage art: the sprite strips built by scripts/build-boss-art.py.
 * Mirrors the themedArt.ts pattern — a load hook for PreloadScene.preload and
 * a setup hook (filters + animations) for PreloadScene.create.
 */

/** Display name on the HUD boss health bar. */
export const BOSS_NAMES: Record<BossId, string> = {
  monarch: "SCHATTEN-MONARCH",
  kraken: "DER KRAKEN",
};

/** Frame geometry of the boss strips (must match the build script output). */
export const MONARCH_FRAME = { w: 137, h: 126, idle: 0, swordLow: 1, swordRaised: 2 };
export const SHADOW_BEAST_FRAME = { w: 45, h: 44, frames: 2 };
export const KRAKEN_FRAME = { w: 168, h: 144, idleA: 0, idleB: 1, attack: 2, stun: 3 };
export const TENTACLE_FRAME = { w: 52, h: 208, frames: 2 };

/** Queue the boss strips for loading (call in PreloadScene.preload). */
export function loadBossArt(scene: Phaser.Scene): void {
  scene.load.spritesheet(TextureKeys.BossMonarch, "assets/sprites/bosses/monarch.png", {
    frameWidth: MONARCH_FRAME.w,
    frameHeight: MONARCH_FRAME.h,
  });
  scene.load.spritesheet(TextureKeys.ShadowBeast, "assets/sprites/bosses/shadow-beast.png", {
    frameWidth: SHADOW_BEAST_FRAME.w,
    frameHeight: SHADOW_BEAST_FRAME.h,
  });
  scene.load.spritesheet(TextureKeys.BossKraken, "assets/sprites/bosses/kraken.png", {
    frameWidth: KRAKEN_FRAME.w,
    frameHeight: KRAKEN_FRAME.h,
  });
  scene.load.spritesheet(TextureKeys.Tentacle, "assets/sprites/bosses/tentacle.png", {
    frameWidth: TENTACLE_FRAME.w,
    frameHeight: TENTACLE_FRAME.h,
  });
  scene.load.image(TextureKeys.ShadowOrb, "assets/sprites/bosses/shadow-orb.png");
  scene.load.image(TextureKeys.InkOrb, "assets/sprites/bosses/ink-orb.png");
}

/** Filters + boss animations (call in PreloadScene.create, after load). */
export function setupBossArt(scene: Phaser.Scene): void {
  // All pixel-art strips stay crisp (the glow orbs keep smooth sampling).
  for (const key of [
    TextureKeys.BossMonarch,
    TextureKeys.ShadowBeast,
    TextureKeys.BossKraken,
    TextureKeys.Tentacle,
  ]) {
    if (scene.textures.exists(key)) {
      scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  const ensure = (key: string, cfg: Phaser.Types.Animations.Animation) => {
    if (!scene.anims.exists(key)) scene.anims.create({ key, ...cfg });
  };

  if (scene.textures.exists(TextureKeys.BossMonarch)) {
    ensure(EnemyAnim.monarchBrandish, {
      frames: scene.anims.generateFrameNumbers(TextureKeys.BossMonarch, {
        frames: [MONARCH_FRAME.swordLow, MONARCH_FRAME.swordRaised],
      }),
      frameRate: 2.5, // slow, menacing brandish while he stalks the arena
      repeat: -1,
    });
  }
  if (scene.textures.exists(TextureKeys.ShadowBeast)) {
    ensure(EnemyAnim.shadowBeastProwl, {
      frames: scene.anims.generateFrameNumbers(TextureKeys.ShadowBeast, {
        start: 0,
        end: SHADOW_BEAST_FRAME.frames - 1,
      }),
      frameRate: 4,
      repeat: -1,
    });
  }
  if (scene.textures.exists(TextureKeys.BossKraken)) {
    ensure(EnemyAnim.krakenIdle, {
      frames: scene.anims.generateFrameNumbers(TextureKeys.BossKraken, {
        frames: [KRAKEN_FRAME.idleA, KRAKEN_FRAME.idleB],
      }),
      frameRate: 2.5, // lazy tentacle sway while it bobs in the pool
      repeat: -1,
    });
  }
  if (scene.textures.exists(TextureKeys.Tentacle)) {
    ensure(EnemyAnim.tentacleWave, {
      frames: scene.anims.generateFrameNumbers(TextureKeys.Tentacle, {
        start: 0,
        end: TENTACLE_FRAME.frames - 1,
      }),
      frameRate: 5,
      repeat: -1,
    });
  }
}
