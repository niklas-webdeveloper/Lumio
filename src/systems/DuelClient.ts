import { CHARACTERS, type CharacterId } from "@/config/characterAssets";
import { LEVELS, LEVEL_COUNT } from "@/config/levels";
import { saveState } from "@/systems/SaveState";

/** The matched opponent (drives the live ghost's sheets + labels). */
export interface DuelOpponent {
  name: string;
  char: CharacterId;
}

/** One relayed sample of the opponent's motion (world px, seconds since GO). */
export interface DuelFrame {
  t: number;
  x: number;
  y: number;
  /** 1 when the sprite was flipped (facing left). */
  f: 0 | 1;
}

/** Final standings, as announced by the server (or by forfeit). */
export interface DuelResult {
  winner: "you" | "opponent" | "draw";
  you: { name: string; time: number; deaths: number };
  opponent: { name: string; time: number; deaths: number };
  /** True when the win came from the opponent leaving, not from a finish. */
  forfeit?: boolean;
}

/**
 * Where the duel currently stands. "hosting" = room created, code on screen;
 * "matched" = both players in the room, scenes loading (ready/GO handshake);
 * "racing" = GO received (the local clock starts after the 3-2-1 countdown);
 * "finished" = the result is in.
 */
export type DuelPhase = "idle" | "hosting" | "matched" | "racing" | "finished";

/** Keep this many seconds of opponent frames for the ghost interpolation. */
const FRAME_KEEP_SEC = 6;
const FRAME_CAP = 120;

/**
 * The client side of the online duel: one WebSocket to the game server's
 * lobby/relay. Physics never crosses the wire — both players run the same
 * level locally and only exchange position frames (for the live ghost) and
 * their finish times. The duel clock is wall time since the local GO, so
 * deaths and even pausing cost real time and can't be gamed.
 *
 * A module singleton, like gameState/saveState: it outlives scene restarts
 * (deaths restart the GameScene mid-race), so the frame buffer and race clock
 * live here rather than in the scene.
 */
class DuelClient {
  private ws: WebSocket | null = null;
  phase: DuelPhase = "idle";
  code: string | null = null;
  opponent: DuelOpponent | null = null;
  levelIndex = 0;
  /** Room creator = "host": picks the level, also for rematches. */
  role: "host" | "guest" = "host";

  /** Rolling buffer of received opponent frames (survives scene restarts). */
  readonly frames: DuelFrame[] = [];
  opponentFinished = false;
  opponentTime: number | null = null;
  myTime: number | null = null;
  result: DuelResult | null = null;

  /** performance.now() at the local GO — the race clock's zero point. */
  private raceStart = 0;
  /** True from the end of the local countdown until finish/leave. */
  racing = false;
  private readySent = false;

  // --- UI callbacks (wired once by the UIManager) ---
  onCreated?: (code: string) => void;
  onMatched?: () => void;
  onGo?: () => void;
  onOpponentFinished?: (time: number) => void;
  onResult?: (result: DuelResult) => void;
  onOpponentLeft?: () => void;
  onRematchRequested?: () => void;
  onRematchStart?: () => void;
  onError?: (message: string) => void;
  /** The socket dropped while a duel was live (lobby or race). */
  onConnectionLost?: () => void;

  /** True while a room/duel is live in any form. */
  get active(): boolean {
    return this.phase !== "idle";
  }

  /** Seconds since the local GO (wall clock — pausing doesn't stop it). */
  elapsed(): number {
    return this.racing || this.myTime !== null
      ? (performance.now() - this.raceStart) / 1000
      : 0;
  }

  /** Open (or reuse) the socket to the duel endpoint. */
  connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.ws) this.ws.close();

    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/ws/duel`);
    this.ws = ws;

    ws.onmessage = (e) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(e.data as string);
      } catch {
        return;
      }
      this.handleMessage(msg);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return; // superseded by a newer connection
      this.ws = null;
      const wasActive = this.active;
      this.resetAll();
      if (wasActive) this.onConnectionLost?.();
    };

    return new Promise((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("Duel server unreachable"));
    });
  }

  private send(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private identity(): { name: string; char: CharacterId } {
    return {
      name: saveState.currentUsername ?? "Spieler",
      char: saveState.getSelectedCharacter(),
    };
  }

  /** Host: open a room for the given level; the code arrives via onCreated. */
  createRoom(levelIndex: number): void {
    this.levelIndex = levelIndex;
    this.send({ type: "create", level: levelIndex, ...this.identity() });
  }

  /** Guest: join a friend's room by its code. */
  joinRoom(code: string): void {
    this.send({ type: "join", code: code.trim().toUpperCase(), ...this.identity() });
  }

  /**
   * GameScene is loaded and waiting at the start line — tell the server.
   * Deaths restart the scene mid-race, so this only fires once per race.
   */
  sendReady(): void {
    if (this.phase !== "matched" || this.readySent) return;
    this.readySent = true;
    this.send({ type: "ready" });
  }

  /** The local 3-2-1 countdown just hit GO — start the race clock. */
  markRaceStarted(): void {
    this.phase = "racing";
    this.racing = true;
    this.raceStart = performance.now();
  }

  /** Stream one position frame to the opponent (t = local race clock). */
  sendPos(x: number, y: number, flipped: boolean): void {
    if (!this.racing) return;
    this.send({
      type: "pos",
      t: Math.round(this.elapsed() * 1000) / 1000,
      x: Math.round(x),
      y: Math.round(y),
      f: flipped ? 1 : 0,
    });
  }

  /** Crossed the finish line: stop the clock, report the time. Returns it. */
  finish(deaths: number): number {
    const time = this.elapsed();
    this.racing = false;
    this.myTime = time;
    this.send({ type: "finish", time, deaths });
    return time;
  }

  /** Ask for a rematch; the host may hand over a (new) level for it. */
  requestRematch(levelIndex?: number): void {
    this.send(
      levelIndex === undefined
        ? { type: "rematch" }
        : { type: "rematch", level: levelIndex }
    );
  }

  /** Clear the per-race state right before a (re)start of the duel level. */
  resetForRace(): void {
    this.frames.length = 0;
    this.opponentFinished = false;
    this.opponentTime = null;
    this.myTime = null;
    this.result = null;
    this.racing = false;
    this.readySent = false;
  }

  /** Abandon the room/duel (safe no-op when idle). Closes the socket. */
  leave(): void {
    if (!this.active && !this.ws) return;
    this.send({ type: "leave" });
    const ws = this.ws;
    this.ws = null; // detach first so onclose doesn't fire onConnectionLost
    ws?.close();
    this.resetAll();
  }

  private resetAll(): void {
    this.phase = "idle";
    this.code = null;
    this.opponent = null;
    this.resetForRace();
  }

  private handleMessage(msg: Record<string, unknown>): void {
    switch (msg.type) {
      case "created":
        this.phase = "hosting";
        this.code = String(msg.code ?? "");
        this.onCreated?.(this.code);
        break;

      case "matched": {
        const opp = (msg.opponent ?? {}) as { name?: string; char?: string };
        const char = (opp.char && opp.char in CHARACTERS ? opp.char : "lumio") as CharacterId;
        this.opponent = { name: opp.name || "Gegner", char };
        this.role = msg.role === "guest" ? "guest" : "host";
        this.levelIndex = sanitizeLevel(msg.level);
        this.phase = "matched";
        this.onMatched?.();
        break;
      }

      case "go":
        this.onGo?.();
        break;

      case "pos": {
        const frame: DuelFrame = {
          t: Number(msg.t) || 0,
          x: Number(msg.x) || 0,
          y: Number(msg.y) || 0,
          f: msg.f ? 1 : 0,
        };
        this.frames.push(frame);
        // Prune: keep a short interpolation window, never grow unbounded.
        const minT = frame.t - FRAME_KEEP_SEC;
        while (
          this.frames.length > FRAME_CAP ||
          (this.frames.length > 2 && this.frames[0].t < minT)
        ) {
          this.frames.shift();
        }
        break;
      }

      case "opponent-finished":
        this.opponentFinished = true;
        this.opponentTime = Number(msg.time) || 0;
        this.onOpponentFinished?.(this.opponentTime);
        break;

      case "result": {
        this.phase = "finished";
        this.racing = false;
        const r = msg as unknown as DuelResult;
        this.result = {
          winner: r.winner === "you" || r.winner === "draw" ? r.winner : "opponent",
          you: r.you ?? { name: "Du", time: 0, deaths: 0 },
          opponent: r.opponent ?? { name: "Gegner", time: 0, deaths: 0 },
        };
        this.onResult?.(this.result);
        break;
      }

      case "rematch-requested":
        this.onRematchRequested?.();
        break;

      case "rematch-start":
        // The host may have picked a different level for this round.
        this.levelIndex = sanitizeLevel(msg.level);
        this.phase = "matched";
        this.onRematchStart?.();
        break;

      case "opponent-left": {
        const wasRacing = this.racing || this.phase === "racing";
        const myTime = this.myTime;
        this.phase = "idle";
        this.code = null;
        this.racing = false;
        // Mid-race walkout = win by forfeit; anywhere else just a notice.
        if (wasRacing || myTime !== null) {
          this.result = {
            winner: "you",
            you: { name: saveState.currentUsername ?? "Du", time: myTime ?? 0, deaths: 0 },
            opponent: { name: this.opponent?.name ?? "Gegner", time: 0, deaths: 0 },
            forfeit: true,
          };
        }
        this.onOpponentLeft?.();
        break;
      }

      case "error":
        this.onError?.(String(msg.message ?? "Unbekannter Fehler"));
        break;

      default:
        break;
    }
  }
}

/** Clamp a wire-level index to a playable (non-boss) level. */
function sanitizeLevel(value: unknown): number {
  const level = Number(value);
  if (!Number.isInteger(level) || level < 0 || level >= LEVEL_COUNT) return 0;
  return LEVELS[level].distance === "boss" ? 0 : level;
}

export const duelClient = new DuelClient();
