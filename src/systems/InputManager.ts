import Phaser from "phaser";

declare global {
  interface Window {
    touchInputState?: {
      left: boolean;
      right: boolean;
      jump: boolean;
      down: boolean;
      useItem: boolean;
      special: boolean;
    };
  }
}

/**
 * The game-agnostic snapshot of player intent for a single frame. Game code
 * reads this struct and never touches raw key objects — so adding a gamepad
 * (or touch controls) later is purely an InputManager concern.
 */
export interface InputState {
  /** -1 = left, 1 = right, 0 = none (horizontal intent). */
  moveX: number;
  /** Sprint modifier held. */
  run: boolean;
  /** Jump pressed on exactly this frame (edge). */
  jumpJustPressed: boolean;
  /** Jump currently held. */
  jumpHeld: boolean;
  /** Jump released on exactly this frame (edge). */
  jumpJustReleased: boolean;
  /** Down (duck / ground-pound) currently held. */
  down: boolean;
  /** Down pressed on exactly this frame (edge). */
  downJustPressed: boolean;
  /** Pause pressed on exactly this frame (edge). */
  pauseJustPressed: boolean;
  /** Use-item (fire burst / star) pressed on exactly this frame (edge). */
  useItemJustPressed: boolean;
  /** Character-ability button (shadow dash) pressed on exactly this frame (edge). */
  specialJustPressed: boolean;
}

/**
 * Reads keyboard input and produces a per-frame {@link InputState}.
 * Call {@link update} once per frame (before entities read state).
 */
export class InputManager {
  private readonly keys: {
    left: Phaser.Input.Keyboard.Key[];
    right: Phaser.Input.Keyboard.Key[];
    jump: Phaser.Input.Keyboard.Key[];
    down: Phaser.Input.Keyboard.Key[];
    run: Phaser.Input.Keyboard.Key[];
    pause: Phaser.Input.Keyboard.Key[];
    useItem: Phaser.Input.Keyboard.Key[];
    special: Phaser.Input.Keyboard.Key[];
  };

  /** Previous-frame edge tracking for buttons we synthesize from multiple keys. */
  private prevJumpHeld = false;
  private prevDownHeld = false;
  private prevPauseHeld = false;
  private prevUseItemHeld = false;
  private prevSpecialHeld = false;

  private state: InputState = {
    moveX: 0,
    run: false,
    jumpJustPressed: false,
    jumpHeld: false,
    jumpJustReleased: false,
    down: false,
    downJustPressed: false,
    pauseJustPressed: false,
    useItemJustPressed: false,
    specialJustPressed: false,
  };

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) {
      throw new Error("Keyboard input plugin is not available.");
    }
    const KeyCodes = Phaser.Input.Keyboard.KeyCodes;
    // enableCapture must stay OFF for these keys: captures are global and
    // preventDefault every keydown — including inside text inputs, where they
    // silently swallow the letters (A/S/D/W/E/X… — half of most usernames).
    // Only the scroll-relevant keys below get an explicit capture.
    const add = (...codes: number[]) => codes.map((c) => kb.addKey(c, false, true));

    this.keys = {
      left: add(KeyCodes.LEFT, KeyCodes.A),
      right: add(KeyCodes.RIGHT, KeyCodes.D),
      jump: add(KeyCodes.SPACE, KeyCodes.W, KeyCodes.UP),
      down: add(KeyCodes.DOWN, KeyCodes.S),
      run: add(KeyCodes.SHIFT),
      pause: add(KeyCodes.P, KeyCodes.ESC),
      useItem: add(KeyCodes.E, KeyCodes.X),
      special: add(KeyCodes.C, KeyCodes.Q),
    };

    // Prevent Space/arrows from scrolling the page.
    kb.addCapture([
      KeyCodes.SPACE,
      KeyCodes.LEFT,
      KeyCodes.RIGHT,
      KeyCodes.UP,
      KeyCodes.DOWN,
    ]);
  }

  /** Recompute the input snapshot for this frame. */
  update(): void {
    const anyDown = (keys: Phaser.Input.Keyboard.Key[]): boolean =>
      keys.some((k) => k.isDown);

    const touch = window.touchInputState || { left: false, right: false, jump: false, down: false, useItem: false, special: false };

    const left = anyDown(this.keys.left) || touch.left;
    const right = anyDown(this.keys.right) || touch.right;
    const jumpHeld = anyDown(this.keys.jump) || touch.jump;
    const downHeld = anyDown(this.keys.down) || touch.down;
    const pauseHeld = anyDown(this.keys.pause);
    const useItemHeld = anyDown(this.keys.useItem) || (touch.useItem ?? false);
    const specialHeld = anyDown(this.keys.special) || (touch.special ?? false);

    this.state.moveX = (right ? 1 : 0) - (left ? 1 : 0);
    this.state.run = anyDown(this.keys.run);
    this.state.jumpHeld = jumpHeld;
    this.state.jumpJustPressed = jumpHeld && !this.prevJumpHeld;
    this.state.jumpJustReleased = !jumpHeld && this.prevJumpHeld;
    this.state.down = downHeld;
    this.state.downJustPressed = downHeld && !this.prevDownHeld;
    this.state.pauseJustPressed = pauseHeld && !this.prevPauseHeld;
    this.state.useItemJustPressed = useItemHeld && !this.prevUseItemHeld;
    this.state.specialJustPressed = specialHeld && !this.prevSpecialHeld;

    this.prevJumpHeld = jumpHeld;
    this.prevDownHeld = downHeld;
    this.prevPauseHeld = pauseHeld;
    this.prevUseItemHeld = useItemHeld;
    this.prevSpecialHeld = specialHeld;
  }

  /** The current frame's input snapshot. */
  getState(): Readonly<InputState> {
    return this.state;
  }
}
