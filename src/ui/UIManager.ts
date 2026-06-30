import type Phaser from "phaser";
import "./ui.css";
import heroUrl from "../../character/character.png";
import { SceneKeys } from "@/config/AssetKeys";
import { LEVELS, getLevel } from "@/config/levels";
import { gameState, Progression } from "@/systems/GameState";
import { saveState } from "@/systems/SaveState";
import { audioManager } from "@/systems/AudioManager";

/** Data passed to the level-complete screen. */
export interface CompleteData {
  bonus: number;
  lastLevel: boolean;
  stars: number;
}

type KeyContext = "home" | "levels" | "pause" | "complete" | "gameover" | "game";

const ICONS: Record<string, string> = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M12 3l9 8h-3v9h-4v-6h-4v6H6v-9H3z"/></svg>',
  retry: '<svg viewBox="0 0 24 24"><path d="M12 6V3L8 7l4 4V8a4 4 0 1 1-4 4H6a6 6 0 1 0 6-6z"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg>',
  sound:
    '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 5V4L8 9zm12 3a3 3 0 0 0-2-2.8v5.6A3 3 0 0 0 16 12zm-2-7v2a5 5 0 0 1 0 10v2a7 7 0 0 0 0-14z"/></svg>',
  coin: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5" fill="#0a1330"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 21S4 14.6 4 9.2A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 8 2.2C20 14.6 12 21 12 21z"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 11h-4v-2h2V7h2z"/></svg>',
};

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

function starsRow(filled: number, big = false): string {
  let s = `<span class="stars${big ? " big" : ""}">`;
  for (let i = 0; i < 3; i++) s += `<span class="star${i < filled ? " on" : ""}">★</span>`;
  return s + "</span>";
}

/**
 * DOM/CSS user interface. Renders all menus, dialogs and the HUD as crisp,
 * resolution-independent HTML over the Phaser canvas, and bridges UI actions to
 * the Phaser game (start/pause/resume/stop the gameplay scene).
 */
class UIManager {
  private game!: Phaser.Game;
  private root!: HTMLDivElement;
  private screens: Record<string, HTMLElement> = {};
  private hud!: HTMLElement;
  private hudEls: Record<string, HTMLElement> = {};
  private muteBtn!: HTMLElement;
  private ctx: KeyContext = "home";
  private selectedLevel = 0;
  private completeLast = false;

  attach(game: Phaser.Game): void {
    this.game = game;
    this.root = el("div");
    this.root.id = "ui-root";
    document.body.appendChild(this.root);

    this.buildHome();
    this.buildLevels();
    this.buildHud();
    window.addEventListener("keydown", (e) => this.onKey(e));
  }

  // ---------- Screen plumbing ----------

  private hideAll(): void {
    for (const s of Object.values(this.screens)) s.classList.add("hidden");
    this.hud.classList.add("hidden");
  }

  private stopGame(): void {
    if (this.game.scene.isActive(SceneKeys.Game)) this.game.scene.stop(SceneKeys.Game);
    if (this.game.scene.isPaused(SceneKeys.Game)) this.game.scene.stop(SceneKeys.Game);
  }

  // ---------- Home ----------

  private buildHome(): void {
    const s = el("div", "ui-screen");
    const title = el("div", "title", "LUMIO'S LEAP");
    const sub = el("div", "subtitle", "a bright platforming adventure");

    const stage = el("div", "home-stage");
    const hero = el("div", "home-hero");
    const img = el("img");
    img.src = heroUrl;
    hero.appendChild(img);

    const actions = el("div", "home-actions");
    const play = el("button", "btn accent big", "Play");
    play.onclick = () => this.showLevels();
    const hi = el("div", "home-hi");
    hi.id = "home-hi";
    actions.append(play, hi);

    stage.append(hero, actions);
    const hint = el("div", "hint", "Press SPACE / ENTER · character by Kibyra");
    s.append(title, sub, stage, hint);
    this.root.appendChild(s);
    this.screens.home = s;
  }

  showHome(): void {
    this.stopGame();
    (this.screens.home.querySelector("#home-hi") as HTMLElement).textContent = `High Score  ${saveState.getHighScore()}`;
    this.hideAll();
    this.closeOverlays();
    this.screens.home.classList.remove("hidden");
    this.screens.home.classList.add("fade-in");
    this.ctx = "home";
  }

  // ---------- Level select ----------

  private buildLevels(): void {
    const s = el("div", "ui-screen");
    s.append(el("div", "title", "LEVELS"));
    const grid = el("div", "level-grid");
    grid.id = "level-grid";
    s.appendChild(grid);
    const back = el("button", "btn", "Back");
    back.onclick = () => this.showHome();
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
      card.innerHTML = locked
        ? `<div class="lock-badge">🔒</div><div class="lvl-num">${i + 1}</div><div class="lvl-name">${lvl.title}</div>`
        : `<div class="lvl-num">${i + 1}</div>${starsRow(saveState.getLevelStars(i))}<div class="lvl-name">${lvl.title}</div>`;
      card.onmouseenter = () => this.selectLevel(i);
      card.onclick = () => this.tryPlay(i);
      grid.appendChild(card);
    });
    this.hideAll();
    this.closeOverlays();
    this.screens.levels.classList.remove("hidden");
    this.screens.levels.classList.add("fade-in");
    this.ctx = "levels";
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
    this.ctx = "game";
    this.hud.classList.remove("hidden");
    this.game.scene.start(SceneKeys.Game);
  }

  /** Called from GameScene.create (fresh start, respawn or retry). */
  onGameSceneCreate(): void {
    this.closeOverlays();
    this.hud.classList.remove("hidden");
    this.ctx = "game";
    this.showLevelTitle();
  }

  // ---------- HUD ----------

  private buildHud(): void {
    const hud = el("div", "hud hidden");
    const left = el("div", "hud-cluster");
    const score = el("div", "chip");
    score.innerHTML = `Score <span class="val" id="hud-score">0</span>`;
    const coins = el("div", "chip coins");
    coins.innerHTML = `<span class="ico">${ICONS.coin}</span><div class="bar"><i id="hud-coinbar"></i></div><span class="val" id="hud-coins">0</span>`;
    const lives = el("div", "chip");
    lives.innerHTML = `<span class="ico" style="color:#ff4d8d">${ICONS.heart}</span><span class="val" id="hud-lives">3</span>`;
    left.append(score, coins, lives);

    const right = el("div", "hud-cluster");
    const level = el("div", "chip");
    level.innerHTML = `<span id="hud-level">Lv 1</span>`;
    const time = el("div", "chip time");
    time.innerHTML = `<span class="ico" style="color:#8effc0">${ICONS.clock}</span><span class="val" id="hud-time">300</span>`;
    const tools = el("div", "hud-right");
    const pause = el("button", "icon-btn small", ICONS.pause);
    pause.onclick = () => this.requestPause();
    this.muteBtn = el("button", "icon-btn small", ICONS.sound);
    this.muteBtn.onclick = () => this.toggleMute();
    tools.append(pause, this.muteBtn);
    right.append(level, time, tools);

    hud.append(left, right);
    this.root.appendChild(hud);
    this.hud = hud;
    this.hudEls = {
      score: hud.querySelector("#hud-score") as HTMLElement,
      coins: hud.querySelector("#hud-coins") as HTMLElement,
      coinbar: hud.querySelector("#hud-coinbar") as HTMLElement,
      lives: hud.querySelector("#hud-lives") as HTMLElement,
      level: hud.querySelector("#hud-level") as HTMLElement,
      time: hud.querySelector("#hud-time") as HTMLElement,
    };
    this.refreshMuteIcon();
  }

  updateHud(): void {
    if (this.hud.classList.contains("hidden")) return;
    this.hudEls.score.textContent = `${gameState.score}`;
    this.hudEls.coins.textContent = `${gameState.coins}`;
    this.hudEls.coinbar.style.width = `${(gameState.coins / Progression.COINS_PER_LIFE) * 100}%`;
    this.hudEls.lives.textContent = `${Math.max(0, gameState.lives)}`;
    this.hudEls.level.textContent = `Lv ${gameState.levelIndex + 1}`;
    this.hudEls.time.textContent = `${Math.ceil(gameState.timeLeft)}`;
  }

  showLevelTitle(): void {
    const card = el("div", "title");
    Object.assign(card.style, {
      position: "absolute",
      top: "30%",
      left: "0",
      right: "0",
      textAlign: "center",
      fontSize: "6vmin",
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

  requestPause(): void {
    if (this.ctx !== "game" || !this.game.scene.isActive(SceneKeys.Game)) return;
    const gs = this.game.scene.getScene(SceneKeys.Game) as unknown as { canPause?: boolean };
    if (gs && gs.canPause === false) return;
    this.game.scene.pause(SceneKeys.Game);
    const o = this.overlay(false);
    const p = el("div", "panel");
    p.append(el("div", "panel-title", "Paused"));
    const row = el("div", "row");
    const resume = el("button", "btn accent", "Resume");
    resume.onclick = () => this.resume();
    const retry = el("button", "btn", "Retry");
    retry.onclick = () => this.restartLevel();
    const home = el("button", "btn", "Home");
    home.onclick = () => this.showHome();
    row.append(resume, retry, home);
    p.appendChild(row);
    o.appendChild(p);
    this.ctx = "pause";
  }

  resume(): void {
    this.closeOverlays();
    this.ctx = "game";
    this.game.scene.resume(SceneKeys.Game);
  }

  restartLevel(): void {
    this.closeOverlays();
    this.ctx = "game";
    this.game.scene.start(SceneKeys.Game);
  }

  showComplete(data: CompleteData): void {
    this.stopGame();
    this.completeLast = data.lastLevel;
    this.hud.classList.add("hidden");
    const o = this.overlay(true);
    const p = el("div", "panel");
    p.append(el("div", "panel-title", data.lastLevel ? "You Win!" : "Completed"));
    p.insertAdjacentHTML("beforeend", starsRow(data.stars, true));
    p.append(el("div", "score", `${gameState.score}`));
    p.append(el("div", "muted-text", `+${data.bonus} time bonus`));
    const row = el("div", "row");
    const retry = el("button", "btn", "Retry");
    retry.onclick = () => this.startLevel(gameState.levelIndex);
    const home = el("button", "btn", "Home");
    home.onclick = () => this.showHome();
    row.append(retry, home);
    if (!data.lastLevel) {
      const next = el("button", "btn accent", "Next");
      next.onclick = () => this.startLevel(gameState.levelIndex + 1);
      row.appendChild(next);
    }
    p.appendChild(row);
    o.appendChild(p);
    this.ctx = "complete";
  }

  showGameOver(): void {
    saveState.recordScore(gameState.score);
    this.stopGame();
    this.hud.classList.add("hidden");
    const o = this.overlay(true);
    const p = el("div", "panel");
    p.append(el("div", "panel-title", "Game Over"));
    p.append(el("div", "score", `${gameState.score}`));
    p.append(el("div", "muted-text", `Best  ${saveState.getHighScore()}`));
    const row = el("div", "row");
    const retry = el("button", "btn accent", "Retry");
    retry.onclick = () => this.startLevel(gameState.levelIndex);
    const home = el("button", "btn", "Home");
    home.onclick = () => this.showHome();
    row.append(retry, home);
    p.appendChild(row);
    o.appendChild(p);
    this.ctx = "gameover";
  }

  // ---------- Audio ----------

  toggleMute(): void {
    const muted = audioManager.toggleMute();
    this.game.sound.mute = muted;
    this.refreshMuteIcon();
  }

  private refreshMuteIcon(): void {
    if (this.muteBtn) this.muteBtn.classList.toggle("muted", audioManager.isMuted());
  }

  // ---------- Keyboard ----------

  private onKey(e: KeyboardEvent): void {
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
        if (k === " " || k === "Enter") this.showLevels();
        break;
      case "levels":
        if (k === "ArrowLeft" || k === "a") this.selectLevel(this.selectedLevel - 1);
        else if (k === "ArrowRight" || k === "d") this.selectLevel(this.selectedLevel + 1);
        else if (k === "Enter" || k === " ") this.tryPlay(this.selectedLevel);
        else if (k === "Escape") this.showHome();
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
        if (k === "Enter" || k === " ") this.startLevel(gameState.levelIndex);
        else if (k === "Escape") this.showHome();
        break;
    }
  }
}

export const ui = new UIManager();
