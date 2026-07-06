/**
 * Small DOM/formatting helpers shared by every UI module (HUD, menus, shop,
 * leaderboard, settings). Pure functions only — no game or audio state here.
 */

/** Base URL for the Hyper Casual UI kit assets (served from public/). */
export const UI = "/assets/ui";

export function el<K extends keyof HTMLElementTagNameMap>(
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
export function imgEl(name: string, className = ""): HTMLImageElement {
  const im = el("img", className);
  im.src = `${UI}/${name}.png`;
  im.alt = "";
  im.draggable = false;
  return im;
}

/** A glossy PNG pill button with a Baloo-2 label (and optional leading icon). */
export function button(
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
export function starsRow(filled: number, big = false): string {
  let s = `<span class="stars${big ? " big" : ""}">`;
  for (let i = 0; i < 3; i++) {
    s += `<img class="${i < filled ? "on" : "off"}" src="${UI}/star.png" alt="" draggable="false">`;
  }
  return s + "</span>";
}

/** Inline <img> markup for a stat icon (HUD chips, leaderboards, shop). */
export function icoTag(name: string): string {
  return `<img src="${UI}/${name}.png" alt="" draggable="false">`;
}

/** Format seconds as m:ss (for the HUD stopwatch and par times). */
export function fmtTime(seconds: number): string {
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Format seconds as m:ss.t (tenths — for results and best times). */
export function fmtTimePrecise(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  const whole = Math.floor(s);
  const tenths = Math.floor((s - whole) * 10);
  return `${m}:${String(whole).padStart(2, "0")}.${tenths}`;
}

export const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (window.innerWidth <= 1024 && window.innerHeight <= 768);
};
