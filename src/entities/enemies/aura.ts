import Phaser from "phaser";
import { TextureKeys } from "@/config/AssetKeys";
import type { Enemy } from "./Enemy";

/** Tuning for an enemy's aura glow. */
export interface AuraOptions {
  /** Glow colour (tints the shared radial-glow texture). */
  color: number;
  /** Peak pulse alpha (the pulse breathes between ~55% and 100% of it). */
  alpha?: number;
  /** Half-cycle of the pulse (ms). */
  pulseMs?: number;
}

/**
 * A soft pulsing glow behind an enemy, drawn as one additively-blended sprite
 * from the shared radial-glow texture. This replaced the per-enemy
 * `preFX.addGlow` aura: preFX routes every glowing sprite through its own
 * framebuffer plus a multi-tap glow shader each frame, which made the themed
 * stages (levels 5/6, up to ~12 glowing enemies) stutter. A tinted batched
 * sprite gives the same look at ordinary sprite cost.
 *
 * The aura follows the enemy every scene update — through the death
 * squash/fade tween too — and cleans itself up when the enemy is destroyed.
 */
export function attachAura(enemy: Enemy, opts: AuraOptions): void {
  const scene = enemy.scene;
  if (!scene.textures.exists(TextureKeys.AuraGlow)) return;

  const aura = scene.add
    .image(enemy.x, enemy.y, TextureKeys.AuraGlow)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setTint(opts.color);
  const peak = opts.alpha ?? 0.45;
  const pulse = { t: 0.55 };
  const tween = scene.tweens.add({
    targets: pulse,
    t: 1,
    duration: opts.pulseMs ?? 900,
    yoyo: true,
    repeat: -1,
    ease: "Sine.inOut",
  });

  const sync = () => {
    if (!aura.active || !enemy.active) return;
    // Enemies anchor at the feet (origin 0.5/1) — centre the aura on the body.
    aura.setPosition(enemy.x, enemy.y - enemy.displayHeight / 2);
    if (aura.depth !== enemy.depth - 0.5) aura.setDepth(enemy.depth - 0.5);
    const d = Math.max(enemy.displayWidth, enemy.displayHeight) * 1.55;
    aura.setDisplaySize(d, d * 0.92);
    aura.setAlpha(peak * pulse.t * enemy.alpha);
    aura.setVisible(enemy.visible);
  };
  sync();
  scene.events.on(Phaser.Scenes.Events.UPDATE, sync);
  enemy.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, sync);
    tween.remove();
    aura.destroy();
  });
}
