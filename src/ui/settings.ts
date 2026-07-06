import { saveState } from "@/systems/SaveState";
import { audioManager } from "@/systems/AudioManager";
import { el, button } from "./dom";

/** What the settings dialog needs from the surrounding UI shell. */
export interface SettingsDeps {
  root: HTMLElement;
  /** Freeze live gameplay while the dialog is open; returns the un-freezer
   *  (or null when nothing needed pausing). */
  pauseGameplay: () => (() => void) | null;
  /** Push a music-volume change into Phaser's sound manager + menu music. */
  applyMusicVolume: () => void;
}

/**
 * The settings dialog (music + SFX volume). Rendered as its own overlay
 * stacked over whatever is on screen, so it never destroys an underlying
 * pause panel. If opened during live gameplay it freezes the scene until
 * closed.
 */
export class SettingsDialog {
  /** Callback that un-freezes gameplay when the dialog was opened over it. */
  private resumeGameplay: (() => void) | null = null;

  constructor(private readonly deps: SettingsDeps) {}

  get isOpen(): boolean {
    return this.deps.root.querySelector(".settings-overlay") !== null;
  }

  open(): void {
    // Adjusting SFX volume should be audible immediately — make sure audio is live.
    audioManager.unlock();
    this.resumeGameplay = this.deps.pauseGameplay();

    const o = el("div", "ui-overlay settings-overlay");
    const p = el("div", "panel teal settings-panel");
    p.appendChild(el("div", "panel-title", "OPTIONEN"));

    p.appendChild(
      this.volumeRow("music", "Musik", saveState.getMusicVolume(), (v) => {
        saveState.setMusicVolume(v);
        this.deps.applyMusicVolume();
      })
    );
    p.appendChild(
      this.volumeRow(
        "sfx",
        "Effekte",
        saveState.getSfxVolume(),
        (v) => audioManager.setSfxVolume(v),
        () => audioManager.play("coin") // preview on release
      )
    );

    const back = button("ZURÜCK", "blue");
    back.onclick = () => this.close();
    p.appendChild(back);

    o.appendChild(p);
    // Click on the dimmed backdrop (outside the panel) closes the dialog.
    o.onclick = (e) => {
      if (e.target === o) this.close();
    };
    this.deps.root.appendChild(o);
  }

  close(): void {
    const open = this.deps.root.querySelectorAll(".settings-overlay");
    if (open.length === 0) return;
    open.forEach((o) => o.remove());
    if (this.resumeGameplay) {
      const resume = this.resumeGameplay;
      this.resumeGameplay = null;
      resume();
    }
  }

  /**
   * A labelled volume slider (icon label + range + live percentage). `onChange`
   * fires continuously while dragging; the optional `onRelease` fires once the
   * drag ends (used to play a preview sound at the new level).
   */
  private volumeRow(
    icon: "music" | "sfx",
    label: string,
    initial: number,
    onChange: (v: number) => void,
    onRelease?: () => void
  ): HTMLElement {
    const row = el("div", "settings-row");

    const glyph = icon === "music"
      ? `<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>`
      : `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.5 8.5a5 5 0 0 1 0 7"></path><path d="M19 5a9 9 0 0 1 0 14"></path>`;
    const lbl = el("div", "settings-label");
    lbl.innerHTML = `
      <svg viewBox="0 0 24 24" width="3.4vmin" height="3.4vmin" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>
      <span>${label}</span>`;

    const control = el("div", "settings-control");
    const input = el("input", "settings-slider") as HTMLInputElement;
    input.type = "range";
    input.min = "0";
    input.max = "100";
    input.step = "1";
    input.value = String(Math.round(initial * 100));

    const pct = el("div", "settings-pct", `${input.value}%`);
    const paint = () => input.style.setProperty("--fill", `${input.value}%`);
    paint();

    input.oninput = () => {
      pct.textContent = `${input.value}%`;
      paint();
      onChange(Number(input.value) / 100);
    };
    if (onRelease) input.onchange = () => onRelease();

    control.append(input, pct);
    row.append(lbl, control);
    return row;
  }
}
