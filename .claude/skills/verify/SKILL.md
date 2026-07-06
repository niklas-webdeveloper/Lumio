---
name: verify
description: How to build, launch and drive Lumio's Leap end-to-end for verification (dev servers, Playwright login + level drive, audio/graphics evidence capture).
---

# Verifying Lumio's Leap

## Launch

Two processes; vite proxies `/api` → :3000.

```bash
node server.js &                 # backend (uses ./saves/*.json when no Mongo)
npx vite --port 5173 &           # game at http://localhost:5173
```

## Drive (Playwright, headless Chromium)

Playwright 1.61 lives in the npx cache — import it by absolute path
(`~/.npm/_npx/<hash>/node_modules/playwright/index.mjs`, find via
`find ~/.npm/_npx -maxdepth 3 -name playwright -type d`). Browsers are already
in `~/Library/Caches/ms-playwright`.

Flow to reach gameplay:
1. `#login-overlay input` → fill a name (e.g. `verifyfox`, exists in ./saves) → click the LOSLEGEN button.
2. Home: `button:has-text("PLAY")` → first `.mode-card` → first `.level-card`.
3. Wait ~2.5s (title card fade), then keyboard: ArrowLeft/ArrowRight run, the player auto-dies fast into the first Plodder — expect scene restarts (black fade frames are the death transition, not a bug).

## Evidence tricks

- **Audio (all SFX/menu music are WebAudio oscillators):** `page.addInitScript` wrapping `AudioContext.prototype.createOscillator` to count `osc.start()` calls. In-level bgm is an .m4a via Phaser sound — creates no oscillators.
- **Camera/parallax per-frame checks:** in DEV, `window.game` is exposed. `game.scene.scenes.find(s => s.parallax)`, hook `cameras.main.on('followupdate', ...)` — it fires after the camera settles for the frame; exact visible left edge is `cam.scrollX + (cam.width - cam.displayWidth) / 2` (worldView.x is rounded, don't use it for sub-pixel checks).
- **GameScene test API:** `scene.__test` (DEV only) has setPlayerPos, counters, etc. — see `exposeTestApi()` in GameScene.
