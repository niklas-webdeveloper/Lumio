import Phaser from "phaser";
import { SceneKeys } from "@/config/AssetKeys";
import { applyDesignViewport } from "@/config/GameConfig";
import { createWorldTextures } from "@/systems/TextureFactory";
import { loadHeroAssets, registerHeroAnimations } from "@/config/characterAssets";
import { loadWorldArt, setupWorldArt } from "@/config/worldArt";
import { loadThemedArt, setupThemedArt } from "@/config/themedArt";
import { loadBackgrounds } from "@/config/backgrounds";
import { ui } from "@/ui/UIManager";

/**
 * PreloadScene: loads all game assets. Progress is reported to the DOM boot
 * splash (see UIManager) — the Phaser canvas draws nothing here so the player
 * only ever sees the single, clean loading screen before it crossfades into
 * the home menu. No in-canvas loading bar (that flickered behind the DOM).
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Preload);
  }

  preload(): void {
    applyDesignViewport(this);
    // Feed Phaser's load progress into the DOM splash bar (0..0.9; the final
    // stretch is reserved for texture generation + UI image decode).
    this.load.on("progress", (value: number) =>
      ui.setLoadProgress(value * 0.9)
    );
    // AAC (160 kbps) — same tracks re-encoded from the 320 kbps mp3 masters
    // (kept in /audio-originals) at less than half the size.
    this.load.audio("bgm-1", "assets/audio/music/track1.m4a");
    this.load.audio("bgm-2", "assets/audio/music/track2.m4a");
    this.load.audio("bgm-3", "assets/audio/music/track3.m4a");
    this.load.audio("bgm-4", "assets/audio/music/track4.m4a");
    this.load.audio("bgm-5", "assets/audio/music/track5.m4a");
    this.load.audio("bgm-6", "assets/audio/music/track6.m4a");
    loadHeroAssets(this); // character sprite sheets + portrait
    loadWorldArt(this); // tileset, blocks, item/enemy strips (SunnyLand art)
    loadThemedArt(this); // per-theme tilesets/enemies/decor (levels 5 & 6)
    loadBackgrounds(this); // per-level parallax background layers
  }

  create(): void {
    // Loaded pixel art first (filters + animations), then the procedural
    // generators — which skip every key the loaded art already fills.
    setupWorldArt(this);
    setupThemedArt(this); // themed tileset filters + shadow-soldier march anim
    createWorldTextures(this);
    registerHeroAnimations(this);
    ui.setLoadProgress(1);
    // Menus/HUD are the DOM UI layer — hand off to its home screen, which waits
    // for critical UI images to decode, then crossfades out of the splash.
    ui.showHome();
  }
}
