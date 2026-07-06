# Lumio's Leap

An original 2D side-scrolling platformer built with **Phaser 3**, **Vite**, and
**TypeScript**. Crisp, controllable movement and a clean pixel-art presentation.

It's an **original brand** with original names (Plodder, Snapvine, Growcap…).
The world art (tiles, background, items, enemies) and the sound effects are
**procedurally generated in code**; the **player character** is an animated
sprite pack by **Kibyra** (see [Credits](#credits)). The asset pipeline is
structured so you can drop in your own art without touching game logic (see
[Swapping in your own assets](#swapping-in-your-own-assets)).

![Lumio's Leap](https://img.shields.io/badge/Phaser-3-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)

## Quick start

```bash
npm install
npm run dev      # dev server at http://localhost:5173
```

Other scripts:

```bash
npm run build     # type-check + production build into dist/
npm run preview   # preview the production build
npm run typecheck # type-check only
```

Requires Node 18+ (developed on Node 24).

## Controls

| Action | Keys |
| --- | --- |
| Move | ← → / A D |
| Jump | Space / W / ↑ (hold for a higher jump) |
| Double jump | press Jump **again** in mid-air — with a flip & spark burst |
| Duck | ↓ / S (hold) — smaller hit-box to slip through low gaps, slower on foot |
| Ground pound | ↓ / S in mid-air — a flip then a fast slam; pops "?" blocks from above |
| Sprint | Shift |
| Pause | P / Esc |
| Mute audio | M |
| Menus | Space / Enter to confirm · Arrows to pick a level · Esc to go back · mouse/click works too |

The game opens on a **home screen** (PLAY) → a **level select** with six
levels grouped by distance: four **short** stages (also played back to back in
the marathon) and two longer **medium** stages. Level 1 is open; clearing a
level unlocks the next (saved locally + on the backend).

## How to play

Run and jump through six stages, collecting coins (100 = an extra life),
opening **?** Lucky Blocks for coins and the **Growcap** power-up (small → big,
lets you smash bricks and survive one hit). Stomp **Plodders** from above; avoid
**Snapvines** that lunge from pipes, plus spikes and bottomless pits. Reach the
**beacon** to clear the stage — a stopwatch times every run.

Each level awards up to **three stars**: one for clearing it, one for
collecting **every coin**, and one for beating the level's **par time**. Your
best time and best coin count per level are saved locally and shown on the
level select — beat them for a **NEW BEST!**.

## Features

- **Game feel**: acceleration/friction movement (walk + sprint), variable jump
  height, **mid-air double jump** (with a flip animation), **duck** (crouch with a
  shrunken hit-box), **ground pound** (a mid-air slam that also pops "?" blocks
  from above), coyote time, jump buffering, asymmetric gravity, terminal velocity.
- **Camera**: deadzone follow + multi-layer parallax background.
- **Content**: coins, Lucky/Brick blocks, the Growcap power-up, small/big player
  states with invulnerability, a walking enemy, a pipe plant, spikes, pits, and a
  goal beacon.
- **A signature mechanic per world**: the desert has **quicksand pits** (wade,
  sink, hop out — don't linger) patrolled by **vultures**; the graveyard hides
  **bats** that hang under platforms and chase you ghost-like once woken; the
  frozen summit is coated in **slippery ice** and drops **icicles** from the
  platforms above. The two medium stages remix those enemies under their own
  anime-styled skies: **Shadow Monarch** (a violet arcane night) and
  **Crimson Shibuya** (a blood-red moon over a burning skyline).
- **Game flow**: title menu, HUD (with a live stopwatch and a per-level coin
  counter), pause, level-complete, game-over, 6 levels with progression —
  4 short + 2 medium-distance. The **marathon** runs the four short stages
  back to back with a world-title splash between levels.
- **Progression**: an earned 3-star rating per level (clear / all coins / beat
  the par time), per-level best times & best coin counts, and coins that fly
  into the HUD counter when collected — all saved in localStorage along with
  the high score.
- **Polish**: animated character, particle effects, screen shake, scene fades,
  and a synthesized chiptune soundtrack + SFX with a mute toggle.

## Project structure

```
src/
  config/
    GameConfig.ts      canvas/scale/physics bootstrap + display constants
    PhysicsConfig.ts   ★ all game-feel constants (tune the movement here)
    AssetKeys.ts       texture/scene keys + player-art key map
    Tiles.ts           tileset GIDs + solid/hazard sets
    levels.ts          level manifest (register new levels here)
  scenes/
    BootScene, PreloadScene, MenuScene, GameScene, UIScene,
    PauseScene, LevelCompleteScene, GameOverScene
  entities/
    Player.ts          movement, states, animation
    Coin.ts, Pipe.ts
    powerups/Growcap.ts
    enemies/            Enemy (base), Plodder, Snapvine
    blocks/             Block (base), LuckyBlock, BrickBlock
  systems/
    InputManager        abstracted input snapshot (gamepad-ready)
    CameraManager       deadzone follow + shake
    ParallaxBackground  layered scrolling sky/hills
    LevelLoader         Tiled JSON -> tilemap + typed spawns
    TextureFactory      procedural art (tiles, sprites, character, particles)
    ParticleManager     one-shot particle bursts
    AudioManager        synthesized SFX + music + mute
    GameState           run-state (lives/score/coins/level/timer)
    SaveState           localStorage + backend persistence
    transition.ts       camera fade helpers
  ui/                   DOM/CSS interface: UIManager (shell + navigation),
                        hud, touch, shop, leaderboard, settings, dom helpers
  levels/               level-01..06.json (Tiled-compatible)
scripts/
  build-medium-levels.py       authors level-05/06 (deterministic layouts)
  build-anime-backgrounds.py   generates the shadow/crimson parallax layers
public/assets/          art, audio, tilesets, backgrounds
```

## Tuning the game feel

Every movement/jump value lives in [`src/config/PhysicsConfig.ts`](src/config/PhysicsConfig.ts)
as a named constant — gravity, walk/run speed, acceleration/friction, jump
velocity, jump-cut multiplier, coyote time, jump buffer, terminal velocity, stomp
bounce. Change a number, save, and the dev server hot-reloads.

## Adding a level

Levels are **Tiled-compatible orthogonal JSON maps** (openable/editable in the
[Tiled editor](https://www.mapeditor.org/)). Each map has:

- a **`terrain`** tile layer using the 8-tile tileset (GIDs in
  [`src/config/Tiles.ts`](src/config/Tiles.ts)): grass, dirt, stone, brick, lucky,
  used, spike, plate — `spike` is a hazard, the rest are solid.
- a **`spawns`** object layer of point objects whose **type** selects the entity:

  | type | meaning | properties |
  | --- | --- | --- |
  | `player` | spawn point | — |
  | `beacon` | level goal | — |
  | `coin` | collectible coin | — |
  | `luckyblock` | "?" block | `reward`: `"coin"` or `"growcap"` |
  | `brick` | breakable brick | — |
  | `plodder` | walking enemy | — |
  | `pipe` | pipe obstacle | `plant`: `true` to add a Snapvine |

To add a level:

1. Create `src/levels/level-XX.json` (hand-author in Tiled, or copy an existing
   one). The repo's levels were produced by small authoring scripts, but the
   output is a standard Tiled file.
2. Register it in [`src/config/levels.ts`](src/config/levels.ts):

   ```ts
   import level05 from "@/levels/level-05.json";
   export const LEVELS: LevelDef[] = [
     /* …existing… */
     { key: "level-05", title: "Your Title", data: level05 },
   ];
   ```

Progression, the level title card, and "Continue" pick it up automatically.

## Swapping in your own assets

All art is generated at runtime by `TextureFactory` under stable keys, and every
generator early-returns if a texture with that key **already exists**. So to use
your own art, simply **load an image under the same key in `PreloadScene.preload()`**
— the generator then skips it and the rest of the game is unchanged.

```ts
// src/scenes/PreloadScene.ts — preload()
this.load.image(TextureKeys.Tiles, "assets/tilesets/terrain.png");
this.load.image(TextureKeys.Beacon, "assets/sprites/beacon.png");
// player frames (each a single image), enemies, etc. — same idea
```

### Asset map

| Logical asset | Key (`src/config/AssetKeys.ts`) | Expected if replaced |
| --- | --- | --- |
| Terrain tileset | `TextureKeys.Tiles` | 288×36 PNG, eight 32px tiles in GID order, 2px-extruded (margin 2 / spacing 4) |
| Sky / hills | `TextureKeys.Sky` / `HillsFar` / `HillsNear` | sky = viewport-sized; hills = seamless, tileable strips |
| Coin / Growcap | `TextureKeys.Coin` / `Growcap` | small sprites (~20–26px) |
| Lucky / Brick / Used | `TextureKeys.LuckyBlock` / `Brick` / `UsedBlock` | 32×32 |
| Plodder / Snapvine / Pipe | `TextureKeys.Plodder` / `Snapvine` / `Pipe` | sprites; pipe ≈ 64×80 |
| Player frames | `PlayerArt.tex.{small,big}.{idle,walk0,walk1,jump}` | one image per frame; small ≈ 24×32, big ≈ 30×46 |
| Particles | `TextureKeys.Spark` / `Crumb` / `Puff` | tiny tintable bits |

Tile size is **32px** on screen; the base render resolution is **640×360**
(scaled to fit the window). Player animations are registered in
`registerPlayerAnimations()` (called from `PreloadScene`); if you change frame
counts, update that function.

### Audio

Sound is **synthesized** in [`src/systems/AudioManager.ts`](src/systems/AudioManager.ts)
(Web Audio oscillators — no audio files). To use recorded audio instead, load
sounds in `PreloadScene` and replace the `play()` / `startMusic()` bodies with
Phaser's sound manager. Mute (M) and the persisted setting still apply.

## Tech notes

- Phaser **Arcade Physics** for gravity and collisions; targets **60 FPS**.
- TypeScript **strict** mode; `@/` path alias maps to `src/`.
- Input is abstracted behind `InputManager` (a per-frame intent snapshot), so a
  gamepad or touch controls can be added in one place.

## Credits

- **Player character** — "2D Pixel Art Character Animated Sprite Pack" by
  **Kibyra** (https://kibyra.itch.io). Used under the pack's license (personal &
  commercial use and edits allowed; redistribution of the pack itself is not).
- **User interface** — a custom **HTML/CSS** layer (`src/ui/`): a modern
  sci-fi theme (glossy buttons, glow, panels, HUD) rendered as crisp, vector
  DOM over the canvas, using the self-hosted **Orbitron** + **Rajdhani** fonts.
- **World art** — tiles, items and enemies from the **SunnyLand** pixel-art
  pack by **Ansimuz** (https://ansimuz.itch.io), composed into game-ready
  sheets by `scripts/build-world-art.py`. Remaining world art (pipe, beacon,
  particles) is generated procedurally in code, as are the SFX.
- **Music** — `public/assets/audio/music/track1-6.m4a` (project-supplied,
  AAC re-encodes of the masters in `/audio-originals`).

## License

The game **code** and the **procedurally generated** assets are original and
MIT licensed (see `LICENSE`). The bundled character sprite pack and music keep
their own licenses/ownership as noted in Credits.
