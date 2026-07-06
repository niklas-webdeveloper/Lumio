/**
 * Typed asset keys — single source of truth for every string used to load or
 * reference an asset. Keeps the codebase free of magic strings and makes it
 * obvious what exists. Populated as milestones add assets.
 */
export const SceneKeys = {
  Boot: "BootScene",
  Preload: "PreloadScene",
  Game: "GameScene",
  // Menus, dialogs and the HUD are the DOM UI layer (src/ui/UIManager.ts).
} as const;

export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];

/**
 * Texture keys for procedurally generated art (TextureFactory) and, later,
 * any loaded image assets. To swap in your own art, register an image under
 * the same key in PreloadScene instead of generating it — nothing else changes.
 */
export const TextureKeys = {
  Tiles: "tex_tiles", // terrain tileset (grid of 32px tiles)
  Sky: "tex_sky", // parallax: static gradient sky + sun glow
  Rays: "tex_rays", // parallax: soft god-ray light beams (additive)
  MenuBg: "tex_menubg", // sleek modern gradient backdrop for menus
  HillsFar: "tex_hills_far", // parallax: distant foliage (tiled)
  HillsNear: "tex_hills_near", // parallax: closer foliage (tiled)
  Beacon: "tex_beacon", // level-end goal marker (pole only)
  BeaconFlag: "tex_beacon_flag", // the pennant, separate so it can slide down
  // Interactive entities (standalone sprite textures)
  LuckyBlock: "tex_lucky", // "?" block (active)
  Brick: "tex_brick", // breakable brick
  UsedBlock: "tex_used", // spent "?" block
  Coin: "tex_coin", // collectible coin
  Growcap: "tex_growcap", // grow power-up
  Gem: "tex_gem", // star-power item (5s invincibility, use on demand)
  ItemFire: "tex_item_fire", // fire-burst item pickup (use on demand)
  Fireball: "tex_fireball", // mini fireball projectile
  // Enemies & obstacles
  Plodder: "tex_plodder", // walking enemy
  Vulture: "tex_vulture", // desert flyer, sine-wave patrol
  BatHang: "tex_bat_hang", // graveyard bat, dormant (hanging) pose
  BatFly: "tex_bat_fly", // graveyard bat, awake chase flight
  Icicle: "tex_icicle", // falling ceiling hazard (snow)
  Snapvine: "tex_snapvine", // piranha-style plant, mouth closed (idle)
  SnapvineMid: "tex_snapvine_mid", // piranha-style plant, mouth half-open (bite anim)
  SnapvineOpen: "tex_snapvine_open", // piranha-style plant, mouth wide open (bite anim peak)
  Pipe: "tex_pipe", // pipe obstacle / plant housing
  // Particle bits
  Spark: "tex_spark", // coin/sparkle particle
  Crumb: "tex_crumb", // brick-fragment particle
  Puff: "tex_puff", // stomp/dust particle
} as const;

/** Animation keys for procedurally generated (frame-swapped) enemy art. */
export const EnemyAnim = {
  snapvineBite: "snapvine-bite",
} as const;

// Player character art now comes from loaded sprite sheets — see
// src/config/characterAssets.ts (HeroSheet / HeroAnim).

