import { el, isMobileDevice } from "./dom";

const STORAGE_KEY_TOUCH_ENABLED = "lumios_leap_touch_controls_enabled";

type TouchKey = "left" | "right" | "jump" | "down" | "useItem";

/**
 * On-screen touch controls: the D-pad/jump/item overlay shown during gameplay
 * plus the little toggle buttons that live in the menu corners and the HUD.
 * Input is published to `window.touchInputState`, which InputManager merges
 * with the keyboard every frame.
 */
export class TouchControls {
  private enabled: boolean;
  private toggleBtns: HTMLButtonElement[] = [];
  private itemBtn: HTMLButtonElement | null = null;
  private overlay: HTMLElement | null = null;

  constructor() {
    window.touchInputState = {
      left: false,
      right: false,
      jump: false,
      down: false,
      useItem: false,
    };
    const stored = localStorage.getItem(STORAGE_KEY_TOUCH_ENABLED);
    this.enabled = stored !== null ? stored === "true" : isMobileDevice();
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Show/hide the gameplay overlay (only visible when enabled AND in-game). */
  setVisible(inGame: boolean): void {
    if (!this.overlay) return;
    this.overlay.classList.toggle("hidden", !(this.enabled && inGame));
  }

  /** Mirror the stashed item icon on the mobile item button. */
  setItemIcon(icon: string): void {
    if (!this.itemBtn) return;
    this.itemBtn.textContent = icon === "–" ? "◇" : icon;
    this.itemBtn.classList.toggle("has-item", icon !== "–");
  }

  /** A corner toggle button; every instance tracks the shared enabled state. */
  makeToggleButton(): HTMLButtonElement {
    const b = el("button", `icon-btn small touch-toggle${this.enabled ? " active" : ""}`);
    b.title = "Touch-Steuerung umschalten";
    b.innerHTML = `
      <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
        <line x1="4" y1="12" x2="10" y2="12"></line>
        <line x1="7" y1="9" x2="7" y2="15"></line>
        <circle cx="17" cy="10" r="1.5" fill="currentColor"></circle>
        <circle cx="20" cy="13" r="1.5" fill="currentColor"></circle>
      </svg>
    `;
    b.onclick = () => this.toggle();
    this.toggleBtns.push(b);
    return b;
  }

  private toggle(): void {
    this.enabled = !this.enabled;
    localStorage.setItem(STORAGE_KEY_TOUCH_ENABLED, String(this.enabled));
    for (const btn of this.toggleBtns) btn.classList.toggle("active", this.enabled);
    this.onToggle?.(this.enabled);
  }

  /** Set by the UIManager so a toggle re-evaluates overlay visibility. */
  onToggle: ((enabled: boolean) => void) | null = null;

  /** Build the gameplay overlay and attach it to the UI root. */
  mount(root: HTMLElement): void {
    const container = el("div", "hidden");
    container.id = "touch-controls";
    this.overlay = container;

    const arrow = (points: string, line: string) => `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <line ${line}></line>
        <polyline points="${points}"></polyline>
      </svg>
    `;

    const leftGroup = el("div", "touch-left-group");
    const btnLeft = el("button", "touch-btn");
    btnLeft.id = "btn-touch-left";
    btnLeft.innerHTML = arrow("12 19 5 12 12 5", `x1="19" y1="12" x2="5" y2="12"`);
    const btnRight = el("button", "touch-btn");
    btnRight.id = "btn-touch-right";
    btnRight.innerHTML = arrow("12 5 19 12 12 19", `x1="5" y1="12" x2="19" y2="12"`);
    leftGroup.append(btnLeft, btnRight);

    const rightGroup = el("div", "touch-right-group");
    const btnDown = el("button", "touch-btn big-jump");
    btnDown.id = "btn-touch-down";
    btnDown.innerHTML = arrow("19 12 12 19 5 12", `x1="12" y1="5" x2="12" y2="19"`);
    const btnJump = el("button", "touch-btn big-jump");
    btnJump.id = "btn-touch-jump";
    btnJump.innerHTML = arrow("5 12 12 5 19 12", `x1="12" y1="19" x2="12" y2="5"`);

    // Mario-Kart-style item button: shows the stashed item, fires it on tap.
    const btnItem = el("button", "touch-btn touch-item");
    btnItem.id = "btn-touch-item";
    btnItem.textContent = "◇";
    this.itemBtn = btnItem;

    rightGroup.append(btnItem, btnDown, btnJump);
    container.append(leftGroup, rightGroup);
    root.appendChild(container);

    this.bind(btnLeft, "left");
    this.bind(btnRight, "right");
    this.bind(btnDown, "down");
    this.bind(btnJump, "jump");
    this.bind(btnItem, "useItem");
  }

  private bind(btn: HTMLElement, stateKey: TouchKey): void {
    const set = (v: boolean) => {
      if (window.touchInputState) window.touchInputState[stateKey] = v;
    };
    const start = (e: Event) => {
      e.preventDefault();
      set(true);
    };
    const end = (e: Event) => {
      e.preventDefault();
      set(false);
    };
    btn.addEventListener("touchstart", start, { passive: false });
    btn.addEventListener("touchend", end, { passive: false });
    btn.addEventListener("touchcancel", end, { passive: false });
    btn.addEventListener("mousedown", start);
    btn.addEventListener("mouseup", () => set(false));
    btn.addEventListener("mouseleave", () => set(false));
  }
}
