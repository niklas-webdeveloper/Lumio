# Lumio's Leap

An original 2D side-scrolling platformer built with **Phaser 3**, **Vite**, and
**TypeScript**. Crisp, controllable movement and a clean pixel-art presentation —
an original brand, not a clone (own character names, own/CC0 assets).

> Status: **in development** — built in milestones (see below).

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
| Move | Arrow keys / A · D |
| Jump | Space / W / Up |
| Sprint | Shift |
| Pause | P / Esc |

## Project structure

```
src/
  config/    game constants (display, physics/game-feel, asset keys, level list)
  scenes/    Boot, Preload, Menu, Game, UI, Pause, LevelComplete, GameOver
  entities/  Player, enemies, coins, power-ups, blocks
  systems/   input, camera, audio, particles, parallax, level loader, save state
  levels/    Tiled-compatible level JSON (level-01.json …)
public/
  assets/    sprites, tilesets, audio, backgrounds
```

## Milestones

1. ✅ Setup — Phaser + Vite + TS, empty GameScene, dev server at 60 FPS.
2. ⬜ Player movement with full game feel.
3. ⬜ Tilemap system + first level + camera + parallax.
4. ⬜ Coins, blocks, items, "big" power-up.
5. ⬜ Enemies + stomp/damage.
6. ⬜ HUD, game states, save state.
7. ⬜ Polish (particles, screen shake, audio) + more levels.
8. ⬜ Docs + final polish.

<!-- Asset-mapping and "how to add a level" docs are added in Milestone 8. -->
