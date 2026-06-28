import Phaser from "phaser";

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
  /** Pause pressed on exactly this frame (edge). */
  pauseJustPressed: boolean;
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
    run: Phaser.Input.Keyboard.Key[];
    pause: Phaser.Input.Keyboard.Key[];
  };

  /** Previous-frame edge tracking for buttons we synthesize from multiple keys. */
  private prevJumpHeld = false;
  private prevPauseHeld = false;

  private state: InputState = {
    moveX: 0,
    run: false,
    jumpJustPressed: false,
    jumpHeld: false,
    jumpJustReleased: false,
    pauseJustPressed: false,
  };

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) {
      throw new Error("Keyboard input plugin is not available.");
    }
    const KeyCodes = Phaser.Input.Keyboard.KeyCodes;
    const add = (...codes: number[]) => codes.map((c) => kb.addKey(c, true, true));

    this.keys = {
      left: add(KeyCodes.LEFT, KeyCodes.A),
      right: add(KeyCodes.RIGHT, KeyCodes.D),
      jump: add(KeyCodes.SPACE, KeyCodes.W, KeyCodes.UP),
      run: add(KeyCodes.SHIFT),
      pause: add(KeyCodes.P, KeyCodes.ESC),
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

    const left = anyDown(this.keys.left);
    const right = anyDown(this.keys.right);
    const jumpHeld = anyDown(this.keys.jump);
    const pauseHeld = anyDown(this.keys.pause);

    this.state.moveX = (right ? 1 : 0) - (left ? 1 : 0);
    this.state.run = anyDown(this.keys.run);
    this.state.jumpHeld = jumpHeld;
    this.state.jumpJustPressed = jumpHeld && !this.prevJumpHeld;
    this.state.jumpJustReleased = !jumpHeld && this.prevJumpHeld;
    this.state.pauseJustPressed = pauseHeld && !this.prevPauseHeld;

    this.prevJumpHeld = jumpHeld;
    this.prevPauseHeld = pauseHeld;
  }

  /** The current frame's input snapshot. */
  getState(): Readonly<InputState> {
    return this.state;
  }
}
