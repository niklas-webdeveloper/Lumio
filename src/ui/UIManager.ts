import type Phaser from "phaser";
import "./ui.css";
import { SceneKeys } from "@/config/AssetKeys";
import { CHARACTERS, CHARACTER_LIST } from "@/config/characterAssets";
import {
  LEVELS,
  getLevel,
  countLevelCoins,
  MARATHON_LEVEL_COUNT,
  type LevelDistance,
} from "@/config/levels";
import type { BgTheme } from "@/config/backgrounds";
import { gameState } from "@/systems/GameState";
import { saveState, type MarathonRecord } from "@/systems/SaveState";
import { ghostStore } from "@/systems/Ghost";
import { audioManager } from "@/systems/AudioManager";
import {
  UI,
  el,
  imgEl,
  button,
  starsRow,
  icoTag,
  fmtTime,
  fmtTimePrecise,
} from "./dom";
import { Hud } from "./hud";
import { TouchControls } from "./touch";
import { openShop } from "./shop";
import { openLeaderboard } from "./leaderboard";
import { SettingsDialog } from "./settings";

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
  /** True on boss stages (arena fights: no coins, different star goals). */
  bossStage?: boolean;
  /** Boss stages: whether the fight was won without taking a hit. */
  noDamage?: boolean;
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

type KeyContext = "home" | "modes" | "levels" | "pause" | "complete" | "gameover" | "game";

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

/** Accent color per theme for the marathon world-title splash. */
const THEME_ACCENT: Record<BgTheme, string> = {
  mountain: "#4f9be0",
  desert: "#e0a53f",
  graveyard: "#9a6ae0",
  snow: "#5fd0e0",
  shadow: "#8a5cff",
  crimson: "#ff4a3a",
  lagoon: "#2ec4a9",
};

/**
 * DOM/CSS user interface shell (Hyper Casual UI kit): screen navigation, the
 * game-flow overlays (pause/complete/game over) and the keyboard bindings.
 * The heavier pieces live in their own modules — Hud (hud.ts), TouchControls
 * (touch.ts), the shop, the leaderboard and the settings dialog — and are
 * composed here.
 */
class UIManager {
  private game!: Phaser.Game;
  private root!: HTMLDivElement;
  private screens: Record<string, HTMLElement> = {};
  private hud!: Hud;
  private touch!: TouchControls;
  private settings!: SettingsDialog;
  private muteImgs: HTMLImageElement[] = [];
  private ctx: KeyContext = "home";
  private selectedLevel = 0;
  private selectedMode = 0;
  private completeLast = false;

  private splash: HTMLElement | null = null;
  private splashFill: HTMLElement | null = null;
  private splashHidden = false;
  /** Resolves once the hero + critical UI images have decoded (or timed out). */
  private assetsReady: Promise<void> = Promise.resolve();

  attach(game: Phaser.Game): void {
    this.game = game;
    this.splash = document.getElementById("boot-splash");
    this.splashFill = document.getElementById("bs-fill");

    this.root = el("div");
    this.root.id = "ui-root";
    document.body.appendChild(this.root);

    this.touch = new TouchControls();
    this.touch.onToggle = () => this.updateTouchControlsVisibility();
    this.settings = new SettingsDialog({
      root: this.root,
      pauseGameplay: () => this.pauseGameplayForDialog(),
      applyMusicVolume: () => this.applyMusicVolume(),
    });

    // One delegated listener gives every menu button/card a plain click sound
    // (runs on the SFX bus, so it follows the "Effekte" slider). Capture phase,
    // so it also fires when a handler swaps the screen or stops propagation.
    // The on-screen touch controls are gameplay input, not menu UI — no click.
    this.root.addEventListener(
      "click",
      (e) => {
        const target = e.target as HTMLElement | null;
        if (!target || target.closest(".touch-btn, #touch-controls")) return;
        if (target.closest("button, .mode-card, .level-card")) {
          audioManager.unlock(); // a click is a user gesture — safe to unlock
          audioManager.play("button");
        }
      },
      true
    );

    this.buildHome();
    this.buildModes();
    this.buildLevels();
    this.hud = new Hud(this.root, {
      onPause: () => this.requestPause(),
      makeTools: () => [
        this.ghostButton(),
        this.touch.makeToggleButton(),
        this.muteButton(),
        this.settingsButton(),
      ],
      onItemIcon: (icon) => this.touch.setItemIcon(icon),
    });
    this.refreshMuteIcon();
    this.touch.mount(this.root);

    this.applyMusicVolume();
    this.assetsReady = this.preloadImages();
    window.addEventListener("keydown", (e) => this.onKey(e));
  }

  private setContext(newCtx: KeyContext): void {
    this.ctx = newCtx;
    // Relaxed synth loop under the menus; silent during gameplay, pause and
    // the result screens (those either show the frozen game or its own bgm).
    if (newCtx === "home" || newCtx === "modes" || newCtx === "levels") {
      audioManager.startMenuMusic();
    } else {
      audioManager.stopMenuMusic();
    }
    this.updateTouchControlsVisibility();
    this.updateLoopState();
  }

  /**
   * Phaser redraws the full canvas every frame even when only a DOM menu is on
   * screen. Outside active gameplay nothing on the canvas moves (menus cover
   * it; on pause it shows a static frame), so put the game loop to sleep there
   * and wake it for play. Saves a lot of GPU/battery/heat.
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
    this.touch.setVisible(this.ctx === "game");
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
      ...CHARACTER_LIST.map((c) => decode(c.portrait.url)),
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
    this.hud.hide();
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

  /** A mute toggle whose icon tracks the shared audio state. */
  private muteButton(): HTMLButtonElement {
    const b = el("button", "icon-btn small");
    const im = imgEl(audioManager.isMuted() ? "sound-off" : "sound-on");
    b.appendChild(im);
    b.onclick = () => this.toggleMute();
    this.muteImgs.push(im);
    return b;
  }

  /** Every ghost-toggle instance (HUD + level select) — kept in sync. */
  private ghostBtns: Array<{ btn: HTMLButtonElement; state?: HTMLElement }> = [];

  private static readonly GHOST_SVG = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
        <path d="M12 3a7 7 0 0 0-7 7v10l2.5-2 2.5 2 2-2 2 2 2.5-2 2.5 2V10a7 7 0 0 0-7-7z"></path>
        <circle cx="9.5" cy="10.5" r="0.8" fill="currentColor"></circle>
        <circle cx="14.5" cy="10.5" r="0.8" fill="currentColor"></circle>
      </svg>
  `;

  /** Push the shared ghost on/off state into every toggle instance. */
  private syncGhostButtons(): void {
    const on = ghostStore.isEnabled();
    for (const g of this.ghostBtns) {
      g.btn.classList.toggle("active", on);
      if (g.state) g.state.textContent = on ? "AN" : "AUS";
    }
  }

  /**
   * The little ghost toggle in the HUD: switches the best-run ghost replay
   * on/off. GameScene polls ghostStore.isEnabled() live, so flipping it
   * mid-run shows/hides the ghost immediately.
   */
  private ghostButton(): HTMLButtonElement {
    const b = el("button", `icon-btn small ghost-toggle${ghostStore.isEnabled() ? " active" : ""}`);
    b.title = "Geist (Bestzeit-Replay) ein/aus";
    b.innerHTML = UIManager.GHOST_SVG;
    b.onclick = () => {
      ghostStore.toggle();
      this.syncGhostButtons();
    };
    this.ghostBtns.push({ btn: b });
    return b;
  }

  /**
   * The labeled ghost toggle on the level-select screen: the natural place to
   * arm the replay, since the ghost starts running the moment a level begins.
   */
  private ghostPill(): HTMLButtonElement {
    const on = ghostStore.isEnabled();
    const b = el("button", `ghost-pill ghost-toggle${on ? " active" : ""}`);
    b.title = "Dein Bestzeit-Geist läuft im Level als Replay mit";
    b.innerHTML =
      UIManager.GHOST_SVG +
      `<span class="gp-label">Geist-Replay</span>` +
      `<span class="gp-state">${on ? "AN" : "AUS"}</span>`;
    const state = b.querySelector(".gp-state") as HTMLElement;
    b.onclick = () => {
      ghostStore.toggle();
      this.syncGhostButtons();
    };
    this.ghostBtns.push({ btn: b, state });
    return b;
  }

  /** A round gear icon button that opens the settings dialog (inline SVG glyph). */
  private settingsButton(): HTMLButtonElement {
    const b = el("button", "icon-btn small settings-btn");
    b.title = "Einstellungen";
    b.innerHTML = `
      <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
        <circle cx="12" cy="12" r="3.2"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    `;
    b.onclick = () => this.settings.open();
    return b;
  }

  /** Freeze a live gameplay scene for a modal dialog; returns the un-freezer. */
  private pauseGameplayForDialog(): (() => void) | null {
    const gs = this.game.scene.getScene(SceneKeys.Game) as unknown as { canPause?: boolean };
    if (
      this.ctx === "game" &&
      this.game.scene.isActive(SceneKeys.Game) &&
      !this.game.scene.isPaused(SceneKeys.Game) &&
      gs?.canPause !== false
    ) {
      this.game.scene.pause(SceneKeys.Game);
      this.game.sound.pauseAll();
      return () => {
        this.game.scene.resume(SceneKeys.Game);
        this.game.sound.resumeAll();
      };
    }
    return null;
  }

  // ---------- Home ----------

  private buildHome(): void {
    const s = el("div", "ui-screen hidden");

    const tools = el("div", "corner-tools");
    tools.appendChild(this.touch.makeToggleButton());
    tools.appendChild(this.muteButton());
    tools.appendChild(this.settingsButton());

    const title = el("div", "title", "LUMIO'S LEAP");
    const sub = el("div", "subtitle", "a bright platforming adventure");

    const stage = el("div", "home-stage");
    const hero = el("div", "home-hero");
    const img = el("img");
    img.id = "home-hero-img";
    img.src = CHARACTERS.lumio.portrait.url;
    hero.appendChild(img);
    const heroName = el("div", "home-hero-name");
    heroName.id = "home-hero-name";
    hero.appendChild(heroName);

    const actions = el("div", "home-actions");
    const play = button("PLAY", "green", { big: true, icon: "play" });
    play.onclick = () => this.showModes();
    const hi = el("div", "home-hi");
    hi.id = "home-hi";
    hi.appendChild(imgEl("crown"));
    hi.appendChild(el("span", "", "High Score 0"));

    const row = el("div", "home-btn-row");
    const shop = button("SHOP", "gold", { icon: "coin" });
    shop.onclick = () => this.showShop();
    const leaderboard = button("BESTENLISTE", "orange", { icon: "star" });
    leaderboard.onclick = () => this.showLeaderboard();
    row.append(shop, leaderboard);

    actions.append(play, hi, row);

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

    // The stage shows whichever character is currently picked to play.
    const char = CHARACTERS[saveState.getSelectedCharacter()];
    const heroImg = this.screens.home.querySelector("#home-hero-img") as HTMLImageElement;
    heroImg.src = char.portrait.url;
    heroImg.classList.toggle("pixelated", char.pixelArt);
    const heroName = this.screens.home.querySelector("#home-hero-name") as HTMLElement;
    heroName.textContent = char.name;

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
    this.syncAudioFromSave();
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
    openLeaderboard({
      overlay: (solid) => this.overlay(solid),
      goHome: () => {
        this.closeOverlays();
        this.showHome();
      },
    });
  }

  showShop(): void {
    this.stopGame();
    this.hideAll();
    this.closeOverlays();
    this.setContext("home");
    openShop({
      overlay: (solid) => this.overlay(solid),
      goHome: () => this.showHome(),
    });
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
      `<div class="mode-icon">${icoTag(opts.icon)}</div>` +
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
      stats: `${icoTag("star")} ${LEVELS.reduce((n, _l, i) => n + saveState.getLevelStars(i), 0)}/${LEVELS.length * 3} Sterne`,
      onPick: () => this.showLevels(),
    });

    const best = saveState.getBestMarathon();
    const marathon = this.modeCard({
      icon: "crown",
      name: "MARATHON",
      desc: `Die ${MARATHON_LEVEL_COUNT} kurzen Level am Stück, 3 Leben für den ganzen Run. Tod = Level neu, die Uhr läuft weiter!`,
      stats: best
        ? `${icoTag("timer")} Bestzeit ${fmtTimePrecise(best.time)}`
        : `${icoTag("timer")} Noch kein Run geschafft`,
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
    this.hud.show();
    this.game.scene.start(SceneKeys.Game);
  }

  // ---------- Level select ----------

  private buildLevels(): void {
    const s = el("div", "ui-screen hidden");
    s.append(el("div", "title", "LEVELS"));
    s.appendChild(this.ghostPill());
    const groups = el("div", "level-groups");
    groups.id = "level-groups";
    s.appendChild(groups);
    const back = button("Back", "blue");
    back.onclick = () => this.showModes();
    s.appendChild(back);
    s.appendChild(el("div", "hint", "← → choose · Enter play · Esc back"));
    this.root.appendChild(s);
    this.screens.levels = s;
  }

  /** One level card (shared by all distance groups). */
  private levelCard(i: number, unlocked: number): HTMLElement {
    const lvl = LEVELS[i];
    const locked = i > unlocked;
    const boss = lvl.distance === "boss";
    const card = el(
      "div",
      `level-card${locked ? " locked" : ""}${lvl.distance === "medium" ? " medium" : ""}${boss ? " boss" : ""}`
    );
    const best = saveState.getBestTime(i);
    // Boss arenas have no coins — show the skull marker instead of a 0/0.
    const meta =
      `<div class="lvl-meta">` +
      `<span>${icoTag("timer")}${best !== null ? fmtTimePrecise(best) : "-:--"}</span>` +
      (boss
        ? `<span>☠ Bosskampf</span>`
        : `<span>${icoTag("coin")}${saveState.getBestCoins(i)}/${countLevelCoins(lvl)}</span>`) +
      `</div>`;
    const num = boss ? "☠" : `${i + 1}`;
    card.innerHTML = locked
      ? `<div class="lock-badge"><img src="${UI}/lock.png" alt="" draggable="false"></div><div class="lvl-name">${lvl.title}</div>`
      : `<div class="lvl-num">${num}</div>${starsRow(saveState.getLevelStars(i))}${meta}<div class="lvl-name">${lvl.title}</div>`;
    card.onmouseenter = () => this.selectLevel(i);
    card.onclick = () => this.tryPlay(i);
    return card;
  }

  showLevels(): void {
    const unlocked = saveState.getUnlockedLevel();
    this.selectedLevel = Math.min(unlocked, LEVELS.length - 1);
    const groups = this.screens.levels.querySelector("#level-groups") as HTMLElement;
    groups.innerHTML = "";

    // The level select is grouped by distance: the classic short stages first
    // (they're also the marathon), then the longer medium stages. DOM order
    // stays the manifest order, so ←/→ keyboard selection works across groups.
    const groupDefs: Array<{ distance: LevelDistance; title: string; sub: string }> = [
      { distance: "short", title: "KURZE DISTANZ", sub: "die klassischen Stages · auch im Marathon" },
      { distance: "medium", title: "MITTLERE DISTANZ", sub: "längere Stages — mehr Strecke, mehr Coins" },
      { distance: "boss", title: "BOSSKÄMPFE", sub: "Arena-Duelle mit Phasen — Sterne für No-Hit und Speed" },
    ];
    for (const def of groupDefs) {
      const indices = LEVELS.map((l, i) => ({ l, i })).filter(
        ({ l }) => l.distance === def.distance
      );
      if (indices.length === 0) continue;
      const group = el("div", `level-group ${def.distance}`);
      const title = el("div", "level-group-title");
      title.innerHTML = `${def.title}<span class="group-sub">${def.sub}</span>`;
      const grid = el("div", "level-grid");
      for (const { i } of indices) grid.appendChild(this.levelCard(i, unlocked));
      group.append(title, grid);
      groups.appendChild(group);
    }

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
    this.hud.show();
    this.game.scene.start(SceneKeys.Game);
  }

  /** Called from GameScene.create (fresh start, respawn or retry). */
  onGameSceneCreate(): void {
    this.closeOverlays();
    this.hud.show();
    this.hud.hideBoss(); // boss stages re-arm it when the boss spawns
    this.setContext("game");
    // The special button follows the played character's active ability.
    this.touch.setSpecialAbility(CHARACTERS[saveState.getSelectedCharacter()].ability);
    this.showLevelTitle();
    this.showNowPlaying();
  }

  /** Mirror the ability cooldown onto the mobile special button (per frame). */
  setSpecialCooldown(frac: number): void {
    this.touch.setSpecialCooldown(frac);
  }

  // ---------- Boss bar bridge (GameScene drives it on boss stages) ----------

  showBossBar(name: string): void {
    this.hud.showBoss(name);
  }

  setBossHp(frac: number): void {
    this.hud.setBossHp(frac);
  }

  hideBossBar(): void {
    this.hud.hideBoss();
  }

  // ---------- HUD bridge (GameScene calls these every frame / per pickup) ----------

  updateHud(): void {
    this.hud.update();
  }

  flyCoinToHud(from: { x: number; y: number }): void {
    this.hud.flyCoin(this.root, from);
  }

  showLevelTitle(): void {
    // The marathon splash IS the (bigger) title card — don't double up.
    if (document.getElementById("marathon-splash")) return;
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
   * Marathon world-title splash between levels: a full-screen theme-tinted
   * card announcing the next stage while the scene restarts underneath.
   */
  showMarathonSplash(levelIndex: number): void {
    const lvl = getLevel(levelIndex);
    if (!lvl) return;
    document.getElementById("marathon-splash")?.remove();

    const o = el("div", "marathon-splash");
    o.id = "marathon-splash";
    o.style.setProperty("--ms-accent", THEME_ACCENT[lvl.theme]);
    o.innerHTML =
      `<div class="ms-count">LEVEL ${levelIndex + 1} / ${MARATHON_LEVEL_COUNT}</div>` +
      `<div class="ms-title">${lvl.title}</div>` +
      `<div class="ms-bar"></div>`;
    this.root.appendChild(o);
    o.animate(
      [
        { opacity: 0 },
        { opacity: 1, offset: 0.12 },
        { opacity: 1, offset: 0.8 },
        { opacity: 0 },
      ],
      { duration: 2400, easing: "ease-out" }
    ).onfinish = () => o.remove();
    // Safety net if the tab is hidden and animations are throttled.
    window.setTimeout(() => o.remove(), 3200);
  }

  /**
   * "Now Playing" toast: slides in below the HUD shortly after the level title,
   * shows the track with a live equalizer, then slides back out on its own.
   */
  private showNowPlaying(): void {
    const lvl = getLevel(gameState.levelIndex);
    if (!lvl || !lvl.trackTitle) return; // levels without a soundtrack: no toast
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
    // Back to the level select — abandons the current run (like Home does).
    const levels = button("Levels", "blue", { icon: "star" });
    levels.onclick = () => {
      this.stopGame();
      this.showLevels();
    };
    if (gameState.isMarathon) {
      // No free level restart mid-marathon — that would dodge the death rule.
      row.append(resume, levels, home);
    } else {
      const retry = button("Retry", "orange");
      retry.onclick = () => this.restartLevel();
      row.append(resume, retry, levels, home);
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
    this.hud.hide();
    const o = this.overlay(true);
    const p = el("div", "panel wide");
    p.append(
      el(
        "div",
        "panel-title",
        data.lastLevel ? "YOU WIN!" : data.bossStage ? "BOSS BESIEGT!" : "LEVEL COMPLETE"
      )
    );
    p.insertAdjacentHTML("beforeend", starsRow(data.stars, true));

    // One line per star: what it's for and whether this run earned it.
    const crit = (earned: boolean, label: string) =>
      `<div class="crit${earned ? "" : " off"}">` +
      `<img src="${UI}/star.png" class="${earned ? "on" : "off"}" alt="" draggable="false">` +
      `<span>${label}</span>` +
      `</div>`;
    const critList = el("div", "crit-list");
    // Boss stages swap the coin star for the no-damage star.
    critList.innerHTML = data.bossStage
      ? crit(true, "Boss besiegt") +
        crit(data.noDamage === true, "Ohne Treffer überstanden") +
        crit(data.underPar, `Beat ${fmtTime(data.parTime)} &nbsp;·&nbsp; ${fmtTimePrecise(data.timeSec)}`)
      : crit(true, "Level cleared") +
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
    this.hud.hide();
    const o = this.overlay(true);
    const p = el("div", "panel wide");
    p.append(el("div", "panel-title", "MARATHON GESCHAFFT!"));
    p.append(el("div", "muted-text mode-subtitle", `Alle ${MARATHON_LEVEL_COUNT} Level am Stück bezwungen`));

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
    this.hud.hide();
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

  /** Apply the persisted music volume to Phaser's sound manager + menu music. */
  private applyMusicVolume(): void {
    if (this.game) this.game.sound.volume = saveState.getMusicVolume();
    audioManager.syncMusicVolume();
  }

  /**
   * Push the just-loaded save's audio settings (mute + both volumes) into the
   * live audio engines. Called after login, since the save arrives after the
   * audio graph is first unlocked.
   */
  private syncAudioFromSave(): void {
    audioManager.syncFromSave();
    this.game.sound.mute = audioManager.isMuted();
    this.applyMusicVolume();
    this.refreshMuteIcon();
  }

  // ---------- Keyboard ----------

  private onKey(e: KeyboardEvent): void {
    const k = e.key;
    // The settings dialog is modal: Escape closes it and swallows other keys so
    // they can't leak into the game/menu behind it.
    if (this.settings.isOpen) {
      if (k === "Escape") this.settings.close();
      return;
    }
    // The shop is modal too: Escape returns home, everything else is swallowed
    // (so Enter/Space can't start a game behind the open shop).
    if (this.root.querySelector("#shop-overlay")) {
      if (k === "Escape") this.showHome();
      return;
    }
    if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
      return;
    }
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
