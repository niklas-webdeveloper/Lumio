import Phaser from "phaser";
import { CHARACTERS, type CharacterId } from "@/config/characterAssets";
import { saveState } from "@/systems/SaveState";
import type { Player } from "@/entities/Player";

/** One recorded sample of the player's motion (world px, seconds). */
export interface GhostFrame {
  t: number;
  x: number;
  y: number;
  /** 1 when the sprite was flipped (facing left). */
  f: 0 | 1;
}

/** A complete best-run recording for one level. */
export interface GhostData {
  /** Character the run was played with (drives the ghost's sheets). */
  char: CharacterId;
  /** Final clear time in seconds. */
  time: number;
  frames: GhostFrame[];
}

/** Sampling interval — 12.5 Hz keeps a 90s run around ~1100 frames. */
const SAMPLE_MS = 80;
/** Storage schema version (bump to invalidate old recordings). */
const VERSION = 1;

const STORAGE_KEY_GHOST_ENABLED = "lumios_leap_ghost_enabled";

/** Local storage key for a level's ghost, scoped to the logged-in profile. */
function ghostKey(levelIndex: number): string {
  const user = (saveState.currentUsername ?? "guest")
    .replace(/[^a-zA-Z0-9_\-]/g, "")
    .toLowerCase();
  return `lumios-leap.ghost.v${VERSION}.${user}.${levelIndex}`;
}

/**
 * Ghost persistence + the global on/off toggle. Recordings live in
 * localStorage only (they'd bloat the synced backend save), so ghosts are
 * per-device — which suits their purpose: racing your own best run.
 */
export const ghostStore = {
  isEnabled(): boolean {
    return localStorage.getItem(STORAGE_KEY_GHOST_ENABLED) !== "false";
  },

  setEnabled(on: boolean): void {
    localStorage.setItem(STORAGE_KEY_GHOST_ENABLED, String(on));
  },

  toggle(): boolean {
    const next = !this.isEnabled();
    this.setEnabled(next);
    return next;
  },

  load(levelIndex: number): GhostData | null {
    try {
      const raw = localStorage.getItem(ghostKey(levelIndex));
      if (!raw) return null;
      const data = JSON.parse(raw) as GhostData;
      if (!data || !Array.isArray(data.frames) || data.frames.length < 2) return null;
      if (!(data.char in CHARACTERS)) data.char = "lumio";
      return data;
    } catch {
      return null;
    }
  },

  save(levelIndex: number, data: GhostData): void {
    try {
      localStorage.setItem(ghostKey(levelIndex), JSON.stringify(data));
    } catch {
      /* storage unavailable/full — the ghost simply isn't kept */
    }
  },
};

/**
 * Records the player's motion during a run. Cheap: one pushed frame every
 * SAMPLE_MS of level time. GameScene finishes it on a new best time.
 */
export class GhostRecorder {
  private readonly frames: GhostFrame[] = [];
  private readonly char: CharacterId;
  private nextSampleAt = 0;

  constructor() {
    this.char = saveState.getSelectedCharacter();
  }

  /** Sample the player at the current level time (call once per frame). */
  update(timeSec: number, player: Player): void {
    if (timeSec < this.nextSampleAt) return;
    this.nextSampleAt = timeSec + SAMPLE_MS / 1000;
    this.frames.push({
      t: Math.round(timeSec * 1000) / 1000,
      x: Math.round(player.x),
      y: Math.round(player.y),
      f: player.flipX ? 1 : 0,
    });
  }

  /** Close the recording with the final clear time. */
  finish(timeSec: number, player: Player): GhostData {
    this.frames.push({
      t: Math.round(timeSec * 1000) / 1000,
      x: Math.round(player.x),
      y: Math.round(player.y),
      f: player.flipX ? 1 : 0,
    });
    return { char: this.char, time: timeSec, frames: this.frames };
  }
}

/**
 * Plays a recorded ghost back as a translucent sprite: position/facing are
 * interpolated between samples, the animation is inferred from the motion.
 * Purely visual — no physics body, no collisions.
 */
export class GhostPlayer {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly data: GhostData;
  private readonly anims: { idle: string; run: string; jump: string; fall: string };
  private cursor = 0;
  private done = false;

  constructor(scene: Phaser.Scene, data: GhostData, depth: number) {
    this.data = data;
    const char = CHARACTERS[data.char];
    this.anims = {
      idle: char.anims.idle,
      run: char.anims.run,
      jump: char.anims.jump,
      fall: char.anims.fall,
    };
    const first = data.frames[0];
    this.sprite = scene.add
      .sprite(first.x, first.y, char.sheets.idle.key, 0)
      .setScale(0.5) // ghosts always render at the small-state scale
      .setAlpha(0.42)
      .setTint(0x9adcff)
      .setDepth(depth);
    this.sprite.anims.play(this.anims.idle);
  }

  /** Advance playback to the given level time (seconds). */
  update(timeSec: number): void {
    if (this.done) return;
    const frames = this.data.frames;
    // Walk the cursor forward to the segment containing timeSec.
    while (this.cursor < frames.length - 2 && frames[this.cursor + 1].t <= timeSec) {
      this.cursor++;
    }
    const a = frames[this.cursor];
    const b = frames[Math.min(this.cursor + 1, frames.length - 1)];

    if (timeSec >= frames[frames.length - 1].t) {
      // Recording over: the ghost finished — fade it out at the goal.
      this.done = true;
      this.sprite.scene.tweens.add({
        targets: this.sprite,
        alpha: 0,
        duration: 600,
        onComplete: () => this.sprite.destroy(),
      });
      return;
    }

    const span = Math.max(0.0001, b.t - a.t);
    const k = Phaser.Math.Clamp((timeSec - a.t) / span, 0, 1);
    const x = Phaser.Math.Linear(a.x, b.x, k);
    const y = Phaser.Math.Linear(a.y, b.y, k);
    this.sprite.setPosition(x, y);
    this.sprite.setFlipX(b.f === 1);

    // Infer the pose from the sampled motion.
    const vx = (b.x - a.x) / span;
    const vy = (b.y - a.y) / span;
    const key =
      vy < -60 ? this.anims.jump : vy > 90 ? this.anims.fall : Math.abs(vx) > 25 ? this.anims.run : this.anims.idle;
    if (this.sprite.anims.currentAnim?.key !== key) this.sprite.anims.play(key, true);
  }

  setVisible(visible: boolean): void {
    this.sprite.setVisible(visible);
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
