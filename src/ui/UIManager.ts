import type Phaser from "phaser";
import "./ui.css";
import heroUrl from "../../character/character.png";
import { SceneKeys } from "@/config/AssetKeys";
import { LEVELS, getLevel, countLevelCoins } from "@/config/levels";
import { gameState } from "@/systems/GameState";
import { saveState, type MarathonRecord } from "@/systems/SaveState";
import { audioManager } from "@/systems/AudioManager";

/** Data passed to the level-complete screen. */
export interface CompleteData {
  bonus: number;
  lastLevel: boolean;
  /** Stars earned this run (1 clear, +1 all coins, +1 under par). */
  stars: number;
  /** Whether every coin in the level was collected this run. */
  allCoins: boolean;
  /** Whether the run finished at or under the level's par time. */
  underPar: boolean;
  /** This run's time in seconds. */
  timeSec: number;
  /** Best recorded time (after this run), in seconds. */
  bestTime: number | null;
  /** True when this run set a new best time (including the first clear). */
  newBestTime: boolean;
  /** The level's par time in seconds (the speed-star goal). */
  parTime: number;
  /** Coins collected this run / total collectible in the level. */
  coins: number;
  coinTotal: number;
}

/** Data passed to the marathon results screen. */
export interface MarathonCompleteData {
  /** Total run time in seconds (includes failed attempts). */
  timeSec: number;
  /** Coins collected across the whole run. */
  coins: number;
  /** Lives lost during the run. */
  deaths: number;
  /** True when this run set a new best time (including the first clear). */
  newBestRun: boolean;
  /** Best recorded run (after this one). */
  best: MarathonRecord | null;
}

/** Format seconds as m:ss (for the HUD stopwatch and par times). */
function fmtTime(seconds: number): string {
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Format seconds as m:ss.t (tenths — for results and best times). */
function fmtTimePrecise(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  const whole = Math.floor(s);
  const tenths = Math.floor((s - whole) * 10);
  return `${m}:${String(whole).padStart(2, "0")}.${tenths}`;
}

type KeyContext = "home" | "modes" | "levels" | "pause" | "complete" | "gameover" | "game";

/** Base URL for the Hyper Casual UI kit assets (served from public/). */
const UI = "/assets/ui";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  html = ""
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (html) e.innerHTML = html;
  return e;
}

/** An <img> pointing at a kit asset (no alt/drag noise). */
function imgEl(name: string, className = ""): HTMLImageElement {
  const im = el("img", className);
  im.src = `${UI}/${name}.png`;
  im.alt = "";
  im.draggable = false;
  return im;
}

/** A glossy PNG pill button with a Baloo-2 label (and optional leading icon). */
function button(
  label: string,
  variant: "green" | "blue" | "gold" | "orange" | "grey" = "green",
  opts: { big?: boolean; icon?: string } = {}
): HTMLButtonElement {
  const b = el("button", `btn ${variant}${opts.big ? " big" : ""}`);
  if (opts.icon) b.appendChild(imgEl(opts.icon));
  b.appendChild(document.createTextNode(label));
  return b;
}

/** A row of three star icons; the first `filled` are lit, the rest dimmed. */
function starsRow(filled: number, big = false): string {
  let s = `<span class="stars${big ? " big" : ""}">`;
  for (let i = 0; i < 3; i++) {
    s += `<img class="${i < filled ? "on" : "off"}" src="${UI}/star.png" alt="" draggable="false">`;
  }
  return s + "</span>";
}

/**
 * DOM/CSS user interface (Hyper Casual UI kit). Renders all menus, dialogs and
 * the HUD as crisp, resolution-independent HTML over the Phaser canvas, using the
 * kit's glossy PNG panels/buttons/icons, and bridges UI actions to the Phaser
 * game (start/pause/resume/stop the gameplay scene).
 */
/**
 * Critical UI images decoded before the home screen is revealed, so menus,
 * buttons and the HUD paint complete on the first frame (no pop-in). CSS
 * background PNGs are warmed into the browser cache the same way.
 */
const PRELOAD_IMAGES = [
  "btn-green",
  "btn-blue",
  "btn-orange",
  "panel-teal",
  "panel-purple",
  "play",
  "crown",
  "star",
  "lock",
  "home",
  "pause",
  "sound-on",
  "sound-off",
  "coin",
  "heart",
  "timer",
];

const STORAGE_KEY_TOUCH_ENABLED = "lumios_leap_touch_controls_enabled";

const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (window.innerWidth <= 1024 && window.innerHeight <= 768);
};

class UIManager {
  private game!: Phaser.Game;
  private root!: HTMLDivElement;
  private screens: Record<string, HTMLElement> = {};
  private hud!: HTMLElement;
  private hudEls: Record<string, HTMLElement> = {};
  private muteImgs: HTMLImageElement[] = [];
  private ctx: KeyContext = "home";
  private selectedLevel = 0;
  private selectedMode = 0;
  private completeLast = false;

  private touchControlsEnabled = false;
  private touchToggleBtns: HTMLButtonElement[] = [];

  private splash: HTMLElement | null = null;
  private splashFill: HTMLElement | null = null;
  private splashHidden = false;
  /** Resolves once the hero + critical UI images have decoded (or timed out). */
  private assetsReady: Promise<void> = Promise.resolve();

  attach(game: Phaser.Game): void {
    this.game = game;
    this.splash = document.getElementById("boot-splash");
    this.splashFill = document.getElementById("bs-fill");

    // Initialize touch state on window
    window.touchInputState = {
      left: false,
      right: false,
      jump: false,
      down: false,
    };

    // Load initial touch enabled status
    const stored = localStorage.getItem(STORAGE_KEY_TOUCH_ENABLED);
    this.touchControlsEnabled = stored !== null ? stored === "true" : isMobileDevice();

    this.root = el("div");
    this.root.id = "ui-root";
    document.body.appendChild(this.root);

    this.buildHome();
    this.buildModes();
    this.buildLevels();
    this.buildHud();
    this.buildTouchControls();

    this.assetsReady = this.preloadImages();
    window.addEventListener("keydown", (e) => this.onKey(e));
  }

  private setContext(newCtx: KeyContext): void {
    this.ctx = newCtx;
    this.updateTouchControlsVisibility();
    this.updateLoopState();
  }

  /**
   * Phaser redraws the full 1920×1080 canvas every frame even when only a DOM
   * menu is on screen. Outside active gameplay nothing on the canvas moves
   * (menus cover it; on pause it shows a static frame), so put the game loop
   * to sleep there and wake it for play. Saves a lot of GPU/battery/heat.
   * Note: contexts that (re)start a scene set ctx to "game" *before* calling
   * scene.start/resume, so the loop is always awake when scene ops run.
   */
  private updateLoopState(): void {
    if (!this.game) return;
    if (this.ctx === "game") {
      // seamless wake: adjusts the loop's start time so there's no delta spike.
      if (!this.game.loop.running) this.game.loop.wake(true);
    } else if (this.game.loop.running) {
      this.game.loop.sleep();
    }
  }

  private updateTouchControlsVisibility(): void {
    const overlay = document.getElementById("touch-controls");
    if (!overlay) return;
    if (this.touchControlsEnabled && this.ctx === "game") {
      overlay.classList.remove("hidden");
    } else {
      overlay.classList.add("hidden");
    }
  }

  private buildTouchControls(): void {
    const container = el("div", "hidden");
    container.id = "touch-controls";

    const leftGroup = el("div", "touch-left-group");
    const btnLeft = el("button", "touch-btn");
    btnLeft.id = "btn-touch-left";
    btnLeft.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <line x1="19" y1="12" x2="5" y2="12"></line>
        <polyline points="12 19 5 12 12 5"></polyline>
      </svg>
    `;

    const btnDown = el("button", "touch-btn big-jump");
    btnDown.id = "btn-touch-down";
    btnDown.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <polyline points="19 12 12 19 5 12"></polyline>
      </svg>
    `;

    const btnRight = el("button", "touch-btn");
    btnRight.id = "btn-touch-right";
    btnRight.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"></line>
        <polyline points="12 5 19 12 12 19"></polyline>
      </svg>
    `;

    leftGroup.append(btnLeft, btnRight);

    const rightGroup = el("div", "touch-right-group");
    const btnJump = el("button", "touch-btn big-jump");
    btnJump.id = "btn-touch-jump";
    btnJump.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="19" x2="12" y2="5"></line>
        <polyline points="5 12 12 5 19 12"></polyline>
      </svg>
    `;

    rightGroup.append(btnDown, btnJump);
    container.append(leftGroup, rightGroup);

    // Append to this.root (which is inside #ui-root) so the .hidden CSS styling is correctly applied
    this.root.appendChild(container);

    const bindEvents = (
      btn: HTMLElement,
      stateKey: "left" | "right" | "jump" | "down"
    ) => {
      const start = (e: Event) => {
        e.preventDefault();
        if (window.touchInputState) {
          window.touchInputState[stateKey] = true;
        }
      };

      const end = (e: Event) => {
        e.preventDefault();
        if (window.touchInputState) {
          window.touchInputState[stateKey] = false;
        }
      };

      btn.addEventListener("touchstart", start, { passive: false });
      btn.addEventListener("touchend", end, { passive: false });
      btn.addEventListener("touchcancel", end, { passive: false });

      btn.addEventListener("mousedown", start);
      const handleMouseUp = () => {
        if (window.touchInputState) {
          window.touchInputState[stateKey] = false;
        }
      };
      btn.addEventListener("mouseup", handleMouseUp);
      btn.addEventListener("mouseleave", handleMouseUp);
    };

    bindEvents(btnLeft, "left");
    bindEvents(btnRight, "right");
    bindEvents(btnDown, "down");
    bindEvents(btnJump, "jump");
  }

  private touchToggleButton(): HTMLButtonElement {
    const b = el("button", `icon-btn small touch-toggle${this.touchControlsEnabled ? " active" : ""}`);
    b.title = "Touch-Steuerung umschalten";
    b.innerHTML = `
      <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
        <line x1="4" y1="12" x2="10" y2="12"></line>
        <line x1="7" y1="9" x2="7" y2="15"></line>
        <circle cx="17" cy="10" r="1.5" fill="currentColor"></circle>
        <circle cx="20" cy="13" r="1.5" fill="currentColor"></circle>
      </svg>
    `;
    b.onclick = () => this.toggleTouchControls();
    this.touchToggleBtns.push(b);
    return b;
  }

  private toggleTouchControls(): void {
    this.touchControlsEnabled = !this.touchControlsEnabled;
    localStorage.setItem(STORAGE_KEY_TOUCH_ENABLED, String(this.touchControlsEnabled));
    for (const btn of this.touchToggleBtns) {
      btn.classList.toggle("active", this.touchControlsEnabled);
    }
    this.updateTouchControlsVisibility();
  }

  // ---------- Boot splash ----------

  /** Drive the boot-splash progress bar (0..1). */
  setLoadProgress(value: number): void {
    if (this.splashFill)
      this.splashFill.style.width = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
  }

  /**
   * Decode the hero portrait + critical UI PNGs. Never rejects and never blocks
   * for long: a timeout resolves it so a slow/failed image can't hang startup.
   */
  private preloadImages(): Promise<void> {
    const decode = (src: string) =>
      new Promise<void>((resolve) => {
        const im = new Image();
        im.onload = () => resolve();
        im.onerror = () => resolve();
        im.src = src;
        // decode() warms the cache without forcing layout; ignore failures.
        im.decode?.().then(() => resolve()).catch(() => resolve());
      });
    const all = Promise.all([
      decode(heroUrl),
      ...PRELOAD_IMAGES.map((n) => decode(`${UI}/${n}.png`)),
    ]).then(() => undefined);
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 1800));
    return Promise.race([all, timeout]);
  }

  /** Crossfade the splash out once assets are ready (idempotent). */
  private hideSplash(): void {
    if (this.splashHidden || !this.splash) return;
    this.splashHidden = true;
    this.assetsReady.then(() => {
      this.setLoadProgress(1);
      const splash = this.splash;
      if (!splash) return;
      splash.classList.add("bs-hide");
      splash.addEventListener("transitionend", () => splash.remove(), {
        once: true,
      });
      // Fallback removal in case the transitionend never fires.
      window.setTimeout(() => splash.remove(), 700);
    });
  }

  // ---------- Screen plumbing ----------

  private hideAll(): void {
    for (const s of Object.values(this.screens)) s.classList.add("hidden");
    this.hud.classList.add("hidden");
  }

  /** Show a menu screen with a fresh fade-in (restarts the animation each time). */
  private revealScreen(s: HTMLElement): void {
    s.classList.remove("hidden");
    s.classList.remove("fade-in");
    void s.offsetWidth; // force reflow so the animation restarts every time
    s.classList.add("fade-in");
  }

  private stopGame(): void {
    if (this.game.scene.isActive(SceneKeys.Game)) this.game.scene.stop(SceneKeys.Game);
    if (this.game.scene.isPaused(SceneKeys.Game)) this.game.scene.stop(SceneKeys.Game);
  }

  /** A round PNG icon button (pause / mute) with hover + press feedback. */
  private iconButton(iconName: string, onClick: () => void): HTMLButtonElement {
    const b = el("button", "icon-btn small");
    b.appendChild(imgEl(iconName));
    b.onclick = onClick;
    return b;
  }

  /** A mute toggle whose icon tracks the shared audio state. */
  private muteButton(): HTMLButtonElement {
    const b = el("button", "icon-btn small");
    const im = imgEl(audioManager.isMuted() ? "sound-off" : "sound-on");
    b.appendChild(im);
    b.onclick = () => this.toggleMute();
    this.muteImgs.push(im);
    return b;
  }

  // ---------- Home ----------

  private buildHome(): void {
    const s = el("div", "ui-screen hidden");

    const tools = el("div", "corner-tools");
    tools.appendChild(this.touchToggleButton());
    tools.appendChild(this.muteButton());

    const title = el("div", "title", "LUMIO'S LEAP");
    const sub = el("div", "subtitle", "a bright platforming adventure");

    const stage = el("div", "home-stage");
    const hero = el("div", "home-hero");
    const img = el("img");
    img.src = heroUrl;
    hero.appendChild(img);

    const actions = el("div", "home-actions");
    const play = button("PLAY", "green", { big: true, icon: "play" });
    play.onclick = () => this.showModes();
    const hi = el("div", "home-hi");
    hi.id = "home-hi";
    hi.appendChild(imgEl("crown"));
    hi.appendChild(el("span", "", "High Score 0"));

    const leaderboard = button("BESTENLISTE", "orange", { icon: "star" });
    leaderboard.onclick = () => this.showLeaderboard();

    actions.append(play, hi, leaderboard);

    stage.append(hero, actions);
    const hint = el("div", "hint", "Press SPACE / ENTER · character by Kibyra");
    s.append(tools, title, sub, stage, hint);
    this.root.appendChild(s);
    this.screens.home = s;
  }

  showHome(): void {
    this.stopGame();
    if (!saveState.currentUsername) {
      this.showLoginOverlay();
      return;
    }
    const hi = this.screens.home.querySelector("#home-hi span") as HTMLElement;
    hi.textContent = `Spieler: ${saveState.currentUsername}`;
    
    const hiContainer = this.screens.home.querySelector("#home-hi") as HTMLElement;
    if (hiContainer) {
      hiContainer.style.cursor = "pointer";
      hiContainer.title = "Spieler wechseln";
      hiContainer.onclick = () => {
        saveState.currentUsername = null;
        this.showLoginOverlay();
      };
    }

    this.hideAll();
    this.closeOverlays();
    this.revealScreen(this.screens.home);
    this.refreshMuteIcon();
    this.setContext("home");
    // First time here: fade the boot splash away to reveal the ready menu.
    this.hideSplash();
  }

  showLoginOverlay(): void {
    this.stopGame();
    this.hideAll();
    this.closeOverlays();
    this.setContext("home");

    const o = this.overlay(true);
    o.id = "login-overlay";

    const p = el("div", "panel teal login-panel");
    p.appendChild(el("div", "panel-title", "PROFIL WÄHLEN"));

    const desc = el("div", "muted-text", "Gib deinen Namen ein, um deinen Spielstand zu laden:");
    desc.style.fontSize = "2.4vmin";
    desc.style.marginBottom = "1.5vmin";
    desc.style.textAlign = "center";
    p.appendChild(desc);

    const input = el("input") as HTMLInputElement;
    input.type = "text";
    input.placeholder = "Dein Name...";
    input.maxLength = 15;
    input.className = "login-input";
    if (saveState.currentUsername) {
      input.value = saveState.currentUsername;
    }
    p.appendChild(input);

    const row = el("div", "row");
    const submitBtn = button("LOSLEGEN", "green", { icon: "play" });

    const handleLogin = async () => {
      const val = input.value.trim();
      if (!val) {
        input.classList.add("error-shake");
        setTimeout(() => input.classList.remove("error-shake"), 500);
        return;
      }
      submitBtn.disabled = true;
      const originalText = submitBtn.innerHTML;
      submitBtn.textContent = "LÄDT...";
      try {
        await saveState.setUsername(val);
        this.closeOverlays();
        this.showHome();
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        console.error("Login failed:", err);
      }
    };

    submitBtn.onclick = handleLogin;
    input.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleLogin();
      }
    };

    row.appendChild(submitBtn);
    p.appendChild(row);
    o.appendChild(p);

    this.hideSplash();
    setTimeout(() => input.focus(), 300);
  }

  showLeaderboard(): void {
    this.stopGame();
    this.hideAll();
    this.closeOverlays();
    this.setContext("home");

    const o = this.overlay(true);
    o.id = "leaderboard-overlay";

    const p = el("div", "panel purple wide");
    p.appendChild(el("div", "panel-title", "BESTENLISTE"));

    const loading = el("div", "muted-text", "Lade Daten...");
    loading.style.textAlign = "center";
    loading.style.fontSize = "2.8vmin";
    p.appendChild(loading);

    const closeBtn = button("ZURÜCK", "blue", { icon: "home" });
    closeBtn.onclick = () => {
      this.closeOverlays();
      this.showHome();
    };

    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((data) => {
        loading.remove();

        const container = el("div", "leaderboard-container");

        for (let i = 0; i < LEVELS.length; i++) {
          const levelDiv = el("div", "leaderboard-level");
          levelDiv.appendChild(el("div", "leaderboard-level-title", `LEVEL ${i + 1}`));

          const list = el("div", "leaderboard-list");
          const levelData = data[i] || [];

          if (levelData.length === 0) {
            list.appendChild(el("div", "leaderboard-empty", "Keine Einträge"));
          } else {
            levelData.forEach((entry: any, index: number) => {
              const row = el("div", "leaderboard-row");

              const rank = el("span", "leaderboard-rank", `${index + 1}.`);
              const name = el("span", "leaderboard-name", entry.username);
              const time = el("span", "leaderboard-time", fmtTimePrecise(entry.time));

              const stars = el("span", "leaderboard-stars");
              stars.innerHTML = starsRow(entry.stars);

              row.append(rank, name, time, stars);
              list.appendChild(row);
            });
          }

          levelDiv.appendChild(list);
          container.appendChild(levelDiv);
        }

        // Marathon board: full-width section below the per-level boards.
        const maraDiv = el("div", "leaderboard-level marathon");
        maraDiv.appendChild(el("div", "leaderboard-level-title", "MARATHON"));
        const maraList = el("div", "leaderboard-list");
        const maraData = data.marathon || [];
        if (maraData.length === 0) {
          maraList.appendChild(el("div", "leaderboard-empty", "Noch kein Run geschafft"));
        } else {
          maraData.forEach((entry: any, index: number) => {
            const row = el("div", "leaderboard-row");
            const rank = el("span", "leaderboard-rank", `${index + 1}.`);
            const name = el("span", "leaderboard-name", entry.username);
            const time = el("span", "leaderboard-time", fmtTimePrecise(entry.time));
            const meta = el("span", "leaderboard-meta");
            meta.innerHTML =
              `${this.icoTag("coin")} ${entry.coins ?? 0}` +
              `<span class="sep">·</span>` +
              `${this.icoTag("heart")} −${entry.deaths ?? 0}`;
            row.append(rank, name, time, meta);
            maraList.appendChild(row);
          });
        }
        maraDiv.appendChild(maraList);
        container.appendChild(maraDiv);

        p.insertBefore(container, closeBtn);
      })
      .catch((err) => {
        loading.textContent = "Fehler beim Laden!";
        console.error("Leaderboard error:", err);
      });

    p.appendChild(closeBtn);
    o.appendChild(p);
  }

  // ---------- Mode select ----------

  private buildModes(): void {
    const s = el("div", "ui-screen hidden");
    s.append(el("div", "title", "SPIELMODUS"));

    const grid = el("div", "mode-grid");
    grid.id = "mode-grid";
    s.appendChild(grid);

    const back = button("Back", "blue");
    back.onclick = () => this.showHome();
    s.appendChild(back);
    s.appendChild(el("div", "hint", "← → wählen · Enter start · Esc zurück"));
    this.root.appendChild(s);
    this.screens.modes = s;
  }

  /** One selectable card on the mode-select screen. */
  private modeCard(opts: {
    icon: string;
    name: string;
    desc: string;
    stats: string;
    onPick: () => void;
    marathon?: boolean;
  }): HTMLElement {
    const card = el("div", `mode-card${opts.marathon ? " marathon" : ""}`);
    card.innerHTML =
      `<div class="mode-icon">${this.icoTag(opts.icon)}</div>` +
      `<div class="mode-name">${opts.name}</div>` +
      `<div class="mode-desc">${opts.desc}</div>` +
      `<div class="mode-stats">${opts.stats}</div>`;
    card.onclick = opts.onPick;
    return card;
  }

  showModes(): void {
    const grid = this.screens.modes.querySelector("#mode-grid") as HTMLElement;
    grid.innerHTML = "";

    const classic = this.modeCard({
      icon: "timer",
      name: "ZEIT-MODUS",
      desc: "Wähle ein Level und jage die Bestzeit. Sterne für Coins und Speed.",
      stats: `${this.icoTag("star")} ${LEVELS.reduce((n, _l, i) => n + saveState.getLevelStars(i), 0)}/${LEVELS.length * 3} Sterne`,
      onPick: () => this.showLevels(),
    });

    const best = saveState.getBestMarathon();
    const marathon = this.modeCard({
      icon: "crown",
      name: "MARATHON",
      desc: `Alle ${LEVELS.length} Level am Stück, 3 Leben für den ganzen Run. Tod = Level neu, die Uhr läuft weiter!`,
      stats: best
        ? `${this.icoTag("timer")} Bestzeit ${fmtTimePrecise(best.time)}`
        : `${this.icoTag("timer")} Noch kein Run geschafft`,
      onPick: () => this.startMarathon(),
      marathon: true,
    });

    classic.onmouseenter = () => this.selectMode(0);
    marathon.onmouseenter = () => this.selectMode(1);
    grid.append(classic, marathon);
    this.selectedMode = 0;

    this.hideAll();
    this.closeOverlays();
    this.revealScreen(this.screens.modes);
    this.setContext("modes");
    this.highlightMode();
  }

  private selectMode(i: number): void {
    this.selectedMode = Math.max(0, Math.min(1, i));
    this.highlightMode();
  }

  private highlightMode(): void {
    const cards = this.screens.modes.querySelectorAll(".mode-card");
    cards.forEach((c, i) => c.classList.toggle("selected", i === this.selectedMode));
  }

  startMarathon(): void {
    gameState.startNewGame(0, "marathon");
    this.hideAll();
    this.closeOverlays();
    this.setContext("game");
    this.hud.classList.remove("hidden");
    this.game.scene.start(SceneKeys.Game);
  }

  // ---------- Level select ----------

  private buildLevels(): void {
    const s = el("div", "ui-screen hidden");
    s.append(el("div", "title", "LEVELS"));
    const grid = el("div", "level-grid");
    grid.id = "level-grid";
    s.appendChild(grid);
    const back = button("Back", "blue");
    back.onclick = () => this.showModes();
    s.appendChild(back);
    s.appendChild(el("div", "hint", "← → choose · Enter play · Esc back"));
    this.root.appendChild(s);
    this.screens.levels = s;
  }

  showLevels(): void {
    const unlocked = saveState.getUnlockedLevel();
    this.selectedLevel = Math.min(unlocked, LEVELS.length - 1);
    const grid = this.screens.levels.querySelector("#level-grid") as HTMLElement;
    grid.innerHTML = "";
    LEVELS.forEach((lvl, i) => {
      const locked = i > unlocked;
      const card = el("div", `level-card${locked ? " locked" : ""}`);
      const best = saveState.getBestTime(i);
      const meta =
        `<div class="lvl-meta">` +
        `<span>${this.icoTag("timer")}${best !== null ? fmtTimePrecise(best) : "-:--"}</span>` +
        `<span>${this.icoTag("coin")}${saveState.getBestCoins(i)}/${countLevelCoins(lvl)}</span>` +
        `</div>`;
      card.innerHTML = locked
        ? `<div class="lock-badge"><img src="${UI}/lock.png" alt="" draggable="false"></div><div class="lvl-name">${lvl.title}</div>`
        : `<div class="lvl-num">${i + 1}</div>${starsRow(saveState.getLevelStars(i))}${meta}<div class="lvl-name">${lvl.title}</div>`;
      card.onmouseenter = () => this.selectLevel(i);
      card.onclick = () => this.tryPlay(i);
      grid.appendChild(card);
    });
    this.hideAll();
    this.closeOverlays();
    this.revealScreen(this.screens.levels);
    this.setContext("levels");
    this.highlightLevel();
  }

  private selectLevel(i: number): void {
    this.selectedLevel = Math.max(0, Math.min(LEVELS.length - 1, i));
    this.highlightLevel();
  }

  private highlightLevel(): void {
    const cards = this.screens.levels.querySelectorAll(".level-card");
    cards.forEach((c, i) => c.classList.toggle("selected", i === this.selectedLevel));
  }

  private tryPlay(i: number): void {
    if (i > saveState.getUnlockedLevel()) {
      const card = this.screens.levels.querySelectorAll(".level-card")[i] as HTMLElement;
      card.animate(
        [{ transform: "translateX(0)" }, { transform: "translateX(-0.8vmin)" }, { transform: "translateX(0.8vmin)" }, { transform: "translateX(0)" }],
        { duration: 220 }
      );
      return;
    }
    this.startLevel(i);
  }

  startLevel(i: number): void {
    gameState.startNewGame(i);
    this.hideAll();
    this.closeOverlays();
    this.setContext("game");
    this.hud.classList.remove("hidden");
    this.game.scene.start(SceneKeys.Game);
  }

  /** Called from GameScene.create (fresh start, respawn or retry). */
  onGameSceneCreate(): void {
    this.closeOverlays();
    this.hud.classList.remove("hidden");
    this.setContext("game");
    this.showLevelTitle();
    this.showNowPlaying();
  }

  // ---------- HUD ----------

  private buildHud(): void {
    const hud = el("div", "hud hidden");
    const left = el("div", "hud-cluster");
    const score = el("div", "chip");
    score.innerHTML = `<span class="lbl">Score</span> <span class="val" id="hud-score">0</span>`;
    const coins = el("div", "chip coins");
    coins.innerHTML = `<span class="ico" id="hud-coin-ico">${this.icoTag("coin")}</span><div class="bar"><i id="hud-coinbar"></i></div><span class="val" id="hud-coins">0</span>`;
    const lives = el("div", "chip");
    lives.innerHTML = `<span class="ico">${this.icoTag("heart")}</span><span class="val" id="hud-lives">3</span>`;
    left.append(score, coins, lives);

    const right = el("div", "hud-cluster");
    const level = el("div", "chip");
    level.innerHTML = `<span class="lbl" id="hud-level">Lv 1</span>`;
    const time = el("div", "chip time");
    time.innerHTML = `<span class="ico">${this.icoTag("timer")}</span><span class="val" id="hud-time">0:00</span>`;
    const tools = el("div", "hud-right");
    const pause = this.iconButton("pause", () => this.requestPause());
    tools.append(pause, this.touchToggleButton(), this.muteButton());
    right.append(level, time, tools);

    hud.append(left, right);
    this.root.appendChild(hud);
    this.hud = hud;
    this.hudEls = {
      score: hud.querySelector("#hud-score") as HTMLElement,
      coins: hud.querySelector("#hud-coins") as HTMLElement,
      coinIco: hud.querySelector("#hud-coin-ico") as HTMLElement,
      coinChip: coins,
      coinbar: hud.querySelector("#hud-coinbar") as HTMLElement,
      lives: hud.querySelector("#hud-lives") as HTMLElement,
      level: hud.querySelector("#hud-level") as HTMLElement,
      time: hud.querySelector("#hud-time") as HTMLElement,
    };
    this.refreshMuteIcon();
  }

  /** Inline <img> markup for a HUD stat icon. */
  private icoTag(name: string): string {
    return `<img src="${UI}/${name}.png" alt="" draggable="false">`;
  }

  /** Last-written HUD strings — updateHud runs every frame, but writing the DOM
   *  60×/s forces style/layout recalcs, so only touch it when a value changed. */
  private hudCache: Record<string, string> = {};

  updateHud(): void {
    if (this.hud.classList.contains("hidden")) return;
    this.setHudText("score", `${gameState.score}`);
    // Level coins vs. the level's total (the "all coins" star goal); the bar
    // fills in sync and is full exactly when every coin was collected.
    const coins = `${gameState.levelCoins}/${gameState.levelCoinTotal}`;
    if (this.hudCache.coins !== coins) {
      this.setHudText("coins", coins);
      const coinFrac =
        gameState.levelCoinTotal > 0 ? gameState.levelCoins / gameState.levelCoinTotal : 0;
      this.hudEls.coinbar.style.width = `${Math.min(1, coinFrac) * 100}%`;
    }
    this.setHudText("lives", `${Math.max(0, gameState.lives)}`);
    // Marathon: show the run progress and the total run clock (it keeps
    // counting across levels and failed attempts — that's the leaderboard time).
    if (gameState.isMarathon) {
      this.setHudText("level", `Lv ${gameState.levelIndex + 1}/${LEVELS.length}`);
      this.setHudText("time", fmtTime(gameState.runTime));
    } else {
      this.setHudText("level", `Lv ${gameState.levelIndex + 1}`);
      this.setHudText("time", fmtTime(gameState.timeElapsed));
    }
  }

  private setHudText(key: string, text: string): void {
    if (this.hudCache[key] === text) return;
    this.hudCache[key] = text;
    this.hudEls[key].textContent = text;
  }

  /**
   * Fly a coin sprite from a viewport position into the HUD coin counter,
   * then bump the counter chip. Called by GameScene on every coin pickup.
   */
  flyCoinToHud(from: { x: number; y: number }): void {
    if (this.hud.classList.contains("hidden")) return;
    const target = this.hudEls.coinIco.getBoundingClientRect();
    const size = Math.max(target.width, 24);
    const coin = imgEl("coin", "fly-coin");
    coin.style.left = `${from.x - size / 2}px`;
    coin.style.top = `${from.y - size / 2}px`;
    coin.style.width = `${size}px`;
    coin.style.height = `${size}px`;
    this.root.appendChild(coin);

    const dx = target.left + target.width / 2 - from.x;
    const dy = target.top + target.height / 2 - from.y;
    coin
      .animate(
        [
          { transform: "translate(0, 0) scale(1.25)", opacity: 1 },
          {
            transform: `translate(${dx * 0.35}px, ${dy * 0.35 - 40}px) scale(1.1)`,
            opacity: 1,
            offset: 0.4,
          },
          { transform: `translate(${dx}px, ${dy}px) scale(0.55)`, opacity: 0.9 },
        ],
        { duration: 520, easing: "cubic-bezier(0.35, 0, 0.6, 1)" }
      )
      .onfinish = () => {
      coin.remove();
      // Pop the counter chip so the arrival reads as "counted".
      const chip = this.hudEls.coinChip;
      chip.classList.remove("bump");
      void chip.offsetWidth; // restart the animation on rapid pickups
      chip.classList.add("bump");
    };
    // Safety net if animations are throttled (hidden tab).
    window.setTimeout(() => coin.remove(), 1200);
  }

  showLevelTitle(): void {
    const card = el("div", "title");
    Object.assign(card.style, {
      position: "absolute",
      top: "28%",
      left: "0",
      right: "0",
      textAlign: "center",
      fontSize: "6.5vmin",
      pointerEvents: "none",
    });
    card.textContent = getLevel(gameState.levelIndex)?.title ?? "";
    this.root.appendChild(card);
    card.animate(
      [
        { opacity: 0, transform: "scale(0.8)" },
        { opacity: 1, transform: "scale(1)", offset: 0.2 },
        { opacity: 1, offset: 0.75 },
        { opacity: 0 },
      ],
      { duration: 2200, easing: "ease-out" }
    ).onfinish = () => card.remove();
  }

  /**
   * "Now Playing" toast: slides in below the HUD shortly after the level title,
   * shows the track with a live equalizer, then slides back out on its own.
   */
  private showNowPlaying(): void {
    const lvl = getLevel(gameState.levelIndex);
    if (!lvl) return;
    document.getElementById("now-playing")?.remove();

    const toast = el("div", "now-playing");
    toast.id = "now-playing";
    toast.innerHTML =
      `<span class="np-eq"><i></i><i></i><i></i><i></i></span>` +
      `<span class="np-text">` +
      `<span class="np-label">Now Playing</span>` +
      `<span class="np-title">${lvl.trackTitle}</span>` +
      `<span class="np-artist">${lvl.trackArtist}</span>` +
      `</span>`;
    this.root.appendChild(toast);
    toast.addEventListener("animationend", (e) => {
      if (e.animationName === "npOut") toast.remove();
    });
    // Safety net if the tab is hidden and animations are throttled.
    window.setTimeout(() => toast.remove(), 8000);
  }

  // ---------- Overlays (pause / complete / game over) ----------

  private closeOverlays(): void {
    this.root.querySelectorAll(".ui-overlay").forEach((o) => o.remove());
  }

  private overlay(solid: boolean): HTMLElement {
    this.closeOverlays();
    const o = el("div", `ui-overlay${solid ? " solid" : ""}`);
    this.root.appendChild(o);
    return o;
  }

  /** True while the 3-2-1 resume countdown is running (blocks re-entry). */
  private resuming = false;

  requestPause(): void {
    if (this.resuming) return;
    if (this.ctx !== "game" || !this.game.scene.isActive(SceneKeys.Game)) return;
    const gs = this.game.scene.getScene(SceneKeys.Game) as unknown as { canPause?: boolean };
    if (gs && gs.canPause === false) return;
    this.game.scene.pause(SceneKeys.Game);
    // The scene pause freezes the timer, but the bgm plays on the global sound
    // manager and keeps going on its own — pause it explicitly.
    this.game.sound.pauseAll();
    const o = this.overlay(false);
    const p = el("div", "panel");
    p.append(el("div", "panel-title", "PAUSED"));
    const row = el("div", "row");
    const resume = button("Resume", "green");
    resume.onclick = () => this.resume();
    const home = button("Home", "blue", { icon: "home" });
    home.onclick = () => this.showHome();
    if (gameState.isMarathon) {
      // No free level restart mid-marathon — that would dodge the death rule.
      row.append(resume, home);
    } else {
      const retry = button("Retry", "orange");
      retry.onclick = () => this.restartLevel();
      row.append(resume, retry, home);
    }
    p.appendChild(row);
    o.appendChild(p);
    this.setContext("pause");
  }

  /**
   * Resume from pause with a 3-2-1 countdown: the pause panel closes, a big
   * animated counter ticks down over the frozen game frame, then the scene,
   * timer and music all pick up together on "GO!".
   */
  resume(): void {
    if (this.resuming) return;
    this.resuming = true;
    this.closeOverlays();

    const o = this.overlay(false);
    o.classList.add("countdown-overlay");
    const num = el("div", "countdown-num");
    o.appendChild(num);

    const steps: Array<{ label: string; ms: number }> = [
      { label: "3", ms: 800 },
      { label: "2", ms: 800 },
      { label: "1", ms: 800 },
      { label: "GO!", ms: 550 },
    ];
    let i = 0;
    const tick = () => {
      // Aborted from outside (e.g. Home stopped the game) — don't resume.
      if (!o.isConnected) {
        this.resuming = false;
        return;
      }
      if (i >= steps.length) {
        this.resuming = false;
        this.closeOverlays();
        this.setContext("game");
        this.game.scene.resume(SceneKeys.Game);
        this.game.sound.resumeAll();
        return;
      }
      const step = steps[i];
      num.textContent = step.label;
      num.classList.toggle("go", step.label === "GO!");
      num.classList.remove("tick");
      void num.offsetWidth; // restart the pop animation for every number
      num.classList.add("tick");
      i += 1;
      window.setTimeout(tick, step.ms);
    };
    tick();
  }

  restartLevel(): void {
    this.closeOverlays();
    this.setContext("game");
    this.game.scene.start(SceneKeys.Game);
  }

  showComplete(data: CompleteData): void {
    this.stopGame();
    this.completeLast = data.lastLevel;
    this.hud.classList.add("hidden");
    const o = this.overlay(true);
    const p = el("div", "panel wide");
    p.append(el("div", "panel-title", data.lastLevel ? "YOU WIN!" : "LEVEL COMPLETE"));
    p.insertAdjacentHTML("beforeend", starsRow(data.stars, true));

    // One line per star: what it's for and whether this run earned it.
    const crit = (earned: boolean, label: string) =>
      `<div class="crit${earned ? "" : " off"}">` +
      `<img src="${UI}/star.png" class="${earned ? "on" : "off"}" alt="" draggable="false">` +
      `<span>${label}</span>` +
      `</div>`;
    const critList = el("div", "crit-list");
    critList.innerHTML =
      crit(true, "Level cleared") +
      crit(data.allCoins, `All coins &nbsp;·&nbsp; ${data.coins}/${data.coinTotal}`) +
      crit(data.underPar, `Beat ${fmtTime(data.parTime)} &nbsp;·&nbsp; ${fmtTimePrecise(data.timeSec)}`);
    p.appendChild(critList);

    const timeBox =
      `<div class="stat-box time"><span class="k">Time</span>` +
      `<span class="v">${fmtTimePrecise(data.timeSec)}</span>` +
      (data.newBestTime ? `<span class="badge-record">NEW BEST!</span>` : "") +
      `</div>`;
    const bestBox =
      `<div class="stat-box"><span class="k">Best</span>` +
      `<span class="v">${data.bestTime !== null ? fmtTimePrecise(data.bestTime) : "-:--"}</span></div>`;
    const timeRow = el("div", "stat-row");
    timeRow.innerHTML = timeBox + bestBox;
    p.appendChild(timeRow);

    const stats = el("div", "stat-row");
    stats.innerHTML =
      `<div class="stat-box"><span class="k">Score</span><span class="v">${gameState.score}</span></div>` +
      `<div class="stat-box coins"><span class="k">Bonus</span><span class="v">+${data.bonus}</span></div>`;
    p.appendChild(stats);

    const row = el("div", "row");
    const retry = button("Retry", "orange");
    retry.onclick = () => this.startLevel(gameState.levelIndex);
    const home = button("Home", "blue", { icon: "home" });
    home.onclick = () => this.showHome();
    if (!data.lastLevel) {
      // Primary call-to-action first (top of the stack).
      const next = button("Next", "green");
      next.onclick = () => this.startLevel(gameState.levelIndex + 1);
      row.append(next, retry, home);
    } else {
      row.append(retry, home);
    }
    p.appendChild(row);
    o.appendChild(p);
    this.setContext("complete");
  }

  /** Marathon run finished: total time, deaths and coins for the whole run. */
  showMarathonComplete(data: MarathonCompleteData): void {
    this.stopGame();
    this.completeLast = true; // Enter on this screen goes home
    this.hud.classList.add("hidden");
    const o = this.overlay(true);
    const p = el("div", "panel wide");
    p.append(el("div", "panel-title", "MARATHON GESCHAFFT!"));
    p.append(el("div", "muted-text mode-subtitle", `Alle ${LEVELS.length} Level am Stück bezwungen`));

    const timeBox =
      `<div class="stat-box time"><span class="k">Gesamtzeit</span>` +
      `<span class="v">${fmtTimePrecise(data.timeSec)}</span>` +
      (data.newBestRun ? `<span class="badge-record">NEW BEST!</span>` : "") +
      `</div>`;
    const bestBox =
      `<div class="stat-box"><span class="k">Bestzeit</span>` +
      `<span class="v">${data.best ? fmtTimePrecise(data.best.time) : "-:--"}</span></div>`;
    const timeRow = el("div", "stat-row");
    timeRow.innerHTML = timeBox + bestBox;
    p.appendChild(timeRow);

    const stats = el("div", "stat-row");
    stats.innerHTML =
      `<div class="stat-box coins"><span class="k">Coins</span><span class="v">${data.coins}</span></div>` +
      `<div class="stat-box"><span class="k">Tode</span><span class="v">${data.deaths}</span></div>` +
      `<div class="stat-box"><span class="k">Score</span><span class="v">${gameState.score}</span></div>`;
    p.appendChild(stats);

    const row = el("div", "row");
    const retry = button("Nochmal", "orange");
    retry.onclick = () => this.startMarathon();
    const home = button("Home", "blue", { icon: "home" });
    home.onclick = () => this.showHome();
    row.append(retry, home);
    p.appendChild(row);
    o.appendChild(p);
    this.setContext("complete");
  }

  showGameOver(): void {
    saveState.recordScore(gameState.score);
    this.stopGame();
    this.hud.classList.add("hidden");
    const marathon = gameState.isMarathon;
    const o = this.overlay(true);
    const p = el("div", "panel purple");
    p.appendChild(imgEl("banner-defeat", "panel-banner"));
    p.append(el("div", "score", `${gameState.score}`));
    if (marathon) {
      p.append(el("div", "muted-text", "Marathon gescheitert — der Run zählt nicht."));
    } else {
      p.append(el("div", "muted-text", `Best  ${saveState.getHighScore()}`));
    }
    const row = el("div", "row");
    const retry = button(marathon ? "Neuer Run" : "Retry", "orange");
    retry.onclick = () => (marathon ? this.startMarathon() : this.startLevel(gameState.levelIndex));
    const home = button("Home", "blue", { icon: "home" });
    home.onclick = () => this.showHome();
    row.append(retry, home);
    p.appendChild(row);
    o.appendChild(p);
    this.setContext("gameover");
  }

  // ---------- Audio ----------

  toggleMute(): void {
    const muted = audioManager.toggleMute();
    this.game.sound.mute = muted;
    this.refreshMuteIcon();
  }

  private refreshMuteIcon(): void {
    const src = `${UI}/${audioManager.isMuted() ? "sound-off" : "sound-on"}.png`;
    for (const im of this.muteImgs) im.src = src;
  }

  // ---------- Keyboard ----------

  private onKey(e: KeyboardEvent): void {
    if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
      return;
    }
    const k = e.key;
    if (k === "m" || k === "M") {
      this.toggleMute();
      return;
    }
    switch (this.ctx) {
      case "game":
        if (k === "p" || k === "P" || k === "Escape") this.requestPause();
        break;
      case "home":
        if (k === " " || k === "Enter") this.showModes();
        break;
      case "modes":
        if (k === "ArrowLeft" || k === "a") this.selectMode(this.selectedMode - 1);
        else if (k === "ArrowRight" || k === "d") this.selectMode(this.selectedMode + 1);
        else if (k === "Enter" || k === " ") {
          if (this.selectedMode === 0) this.showLevels();
          else this.startMarathon();
        } else if (k === "Escape") this.showHome();
        break;
      case "levels":
        if (k === "ArrowLeft" || k === "a") this.selectLevel(this.selectedLevel - 1);
        else if (k === "ArrowRight" || k === "d") this.selectLevel(this.selectedLevel + 1);
        else if (k === "Enter" || k === " ") this.tryPlay(this.selectedLevel);
        else if (k === "Escape") this.showModes();
        break;
      case "pause":
        if (k === "p" || k === "P" || k === "Escape") this.resume();
        break;
      case "complete":
        if (k === "Enter" || k === " ") {
          if (this.completeLast) this.showHome();
          else this.startLevel(gameState.levelIndex + 1);
        } else if (k === "Escape") this.showHome();
        break;
      case "gameover":
        if (k === "Enter" || k === " ") {
          if (gameState.isMarathon) this.startMarathon();
          else this.startLevel(gameState.levelIndex);
        } else if (k === "Escape") this.showHome();
        break;
    }
  }
}

export const ui = new UIManager();
