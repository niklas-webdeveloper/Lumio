import { MARATHON_LEVEL_COUNT } from "@/config/levels";
import { gameState } from "@/systems/GameState";
import { saveState } from "@/systems/SaveState";
import { el, imgEl, icoTag, fmtTime } from "./dom";

/** Buttons the HUD hosts but that are owned by the UIManager (pause, mute…). */
export interface HudDeps {
  onPause: () => void;
  /** Corner tools appended after the pause button (touch/mute/settings). */
  makeTools: () => HTMLElement[];
  /** Mirrors the stashed item icon onto the mobile item button. */
  onItemIcon: (icon: string) => void;
}

/**
 * The in-game HUD strip: score, level-coin bar, lives, item slot, account
 * balance, level tag and stopwatch. Updated every frame via update(), but DOM
 * writes only happen when a value actually changed.
 */
export class Hud {
  readonly element: HTMLElement;
  private els: Record<string, HTMLElement> = {};
  private cache: Record<string, string> = {};

  constructor(root: HTMLElement, private readonly deps: HudDeps) {
    const hud = el("div", "hud hidden");
    const left = el("div", "hud-cluster");
    const score = el("div", "chip");
    score.innerHTML = `<span class="lbl">Score</span> <span class="val" id="hud-score">0</span>`;
    const coins = el("div", "chip coins");
    coins.innerHTML = `<span class="ico" id="hud-coin-ico">${icoTag("coin")}</span><div class="bar"><i id="hud-coinbar"></i></div><span class="val" id="hud-coins">0</span>`;
    const lives = el("div", "chip");
    lives.innerHTML = `<span class="ico">${icoTag("heart")}</span><span class="val" id="hud-lives">3</span>`;
    // Item slot: the stashed "?" block special item, used with E/X or the
    // on-screen item button.
    const item = el("div", "chip item-slot");
    item.innerHTML = `<span class="lbl">Item</span> <span class="val" id="hud-item">–</span>`;
    // Account balance (the shop currency) — updates live as coins are collected.
    const total = el("div", "chip total-coins");
    total.innerHTML = `<span class="ico">${icoTag("coin")}</span><span class="lbl">Gesamt</span> <span class="val" id="hud-total">0</span>`;
    left.append(score, coins, lives, item, total);

    const right = el("div", "hud-cluster");
    const level = el("div", "chip");
    level.innerHTML = `<span class="lbl" id="hud-level">Lv 1</span>`;
    const time = el("div", "chip time");
    time.innerHTML = `<span class="ico">${icoTag("timer")}</span><span class="val" id="hud-time">0:00</span>`;
    const tools = el("div", "hud-right");
    const pause = el("button", "icon-btn small");
    pause.appendChild(imgEl("pause"));
    pause.onclick = () => this.deps.onPause();
    tools.append(pause, ...this.deps.makeTools());
    right.append(level, time, tools);

    hud.append(left, right);

    // Boss health bar (boss stages only): name + a draining fill, centered
    // under the HUD strip. Lives inside the HUD so it hides along with it.
    const bossBar = el("div", "boss-bar hidden");
    bossBar.innerHTML =
      `<div class="bb-name" id="hud-boss-name"></div>` +
      `<div class="bb-track"><i id="hud-boss-fill"></i></div>`;
    hud.appendChild(bossBar);

    root.appendChild(hud);
    this.element = hud;
    this.els = {
      score: hud.querySelector("#hud-score") as HTMLElement,
      coins: hud.querySelector("#hud-coins") as HTMLElement,
      coinIco: hud.querySelector("#hud-coin-ico") as HTMLElement,
      coinChip: coins,
      coinbar: hud.querySelector("#hud-coinbar") as HTMLElement,
      lives: hud.querySelector("#hud-lives") as HTMLElement,
      total: hud.querySelector("#hud-total") as HTMLElement,
      item: hud.querySelector("#hud-item") as HTMLElement,
      level: hud.querySelector("#hud-level") as HTMLElement,
      time: hud.querySelector("#hud-time") as HTMLElement,
      bossBar,
      bossName: hud.querySelector("#hud-boss-name") as HTMLElement,
      bossFill: hud.querySelector("#hud-boss-fill") as HTMLElement,
    };
  }

  /** Show the boss bar (full) with the boss's name. */
  showBoss(name: string): void {
    this.els.bossName.textContent = name;
    this.els.bossFill.style.width = "100%";
    this.els.bossBar.classList.remove("hidden");
  }

  /** Drain the boss bar to the given fraction (with a hit flash). */
  setBossHp(frac: number): void {
    this.els.bossFill.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
    const bar = this.els.bossBar;
    bar.classList.remove("hit");
    void bar.offsetWidth; // restart the flash on rapid hits
    bar.classList.add("hit");
  }

  hideBoss(): void {
    this.els.bossBar.classList.add("hidden");
  }

  get hidden(): boolean {
    return this.element.classList.contains("hidden");
  }

  show(): void {
    this.element.classList.remove("hidden");
  }

  hide(): void {
    this.element.classList.add("hidden");
  }

  update(): void {
    if (this.hidden) return;
    this.set("score", `${gameState.score}`);
    // Level coins vs. the level's total (the "all coins" star goal); the bar
    // fills in sync and is full exactly when every coin was collected.
    const coins = `${gameState.levelCoins}/${gameState.levelCoinTotal}`;
    if (this.cache.coins !== coins) {
      this.set("coins", coins);
      const coinFrac =
        gameState.levelCoinTotal > 0 ? gameState.levelCoins / gameState.levelCoinTotal : 0;
      this.els.coinbar.style.width = `${Math.min(1, coinFrac) * 100}%`;
    }
    this.set("lives", `${Math.max(0, gameState.lives)}`);
    this.set("total", `${saveState.getTotalCoins()}`);
    // Item slot + the mobile item button mirror the stashed special item.
    const itemIcon =
      gameState.heldItem === "fireburst" ? "🔥" : gameState.heldItem === "star" ? "💎" : "–";
    if (this.cache.item !== itemIcon) {
      this.set("item", itemIcon);
      this.deps.onItemIcon(itemIcon);
    }
    // Marathon: show the run progress and the total run clock (it keeps
    // counting across levels and failed attempts — that's the leaderboard time).
    if (gameState.isMarathon) {
      this.set("level", `Lv ${gameState.levelIndex + 1}/${MARATHON_LEVEL_COUNT}`);
      this.set("time", fmtTime(gameState.runTime));
    } else {
      this.set("level", `Lv ${gameState.levelIndex + 1}`);
      this.set("time", fmtTime(gameState.timeElapsed));
    }
  }

  /** Last-written HUD strings — writing the DOM 60×/s forces style/layout
   *  recalcs, so only touch it when a value changed. */
  private set(key: string, text: string): void {
    if (this.cache[key] === text) return;
    this.cache[key] = text;
    this.els[key].textContent = text;
  }

  /**
   * Fly a coin sprite from a viewport position into the HUD coin counter,
   * then bump the counter chip. Called by GameScene on every coin pickup.
   */
  flyCoin(root: HTMLElement, from: { x: number; y: number }): void {
    if (this.hidden) return;
    const target = this.els.coinIco.getBoundingClientRect();
    const size = Math.max(target.width, 24);
    const coin = imgEl("coin", "fly-coin");
    coin.style.left = `${from.x - size / 2}px`;
    coin.style.top = `${from.y - size / 2}px`;
    coin.style.width = `${size}px`;
    coin.style.height = `${size}px`;
    root.appendChild(coin);

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
      const chip = this.els.coinChip;
      chip.classList.remove("bump");
      void chip.offsetWidth; // restart the animation on rapid pickups
      chip.classList.add("bump");
    };
    // Safety net if animations are throttled (hidden tab).
    window.setTimeout(() => coin.remove(), 1200);
  }
}
