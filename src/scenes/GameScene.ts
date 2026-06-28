import Phaser from "phaser";
import { SceneKeys } from "@/config/AssetKeys";
import { GAME_HEIGHT } from "@/config/GameConfig";
import { Player } from "@/entities/Player";
import { InputManager } from "@/systems/InputManager";
import { createPlaceholderTextures } from "@/systems/PlaceholderTextures";

/** Milestone-2 test arena dimensions (wider than the screen to test scrolling). */
const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = GAME_HEIGHT;

/**
 * GameScene: core gameplay.
 *
 * Milestone 2 builds a placeholder test arena (rectangles, no art) to tune and
 * verify the player's movement feel: platforms at varying heights, gaps, walls,
 * and a high ledge to exercise coyote-time, jump-buffering and variable jump
 * height. A live debug overlay shows velocity and timer state.
 */
export class GameScene extends Phaser.Scene {
  private player!: Player;
  private input2!: InputManager;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private debugText!: Phaser.GameObjects.Text;
  private spawnPoint = new Phaser.Math.Vector2(80, 200);

  constructor() {
    super(SceneKeys.Game);
  }

  create(): void {
    createPlaceholderTextures(this);

    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBackgroundColor("#1a1c2c");

    this.buildTestArena();

    // Player + input.
    this.input2 = new InputManager(this);
    this.player = new Player(this, this.spawnPoint.x, this.spawnPoint.y);
    this.physics.add.collider(this.player, this.platforms);

    // Basic camera follow (deadzone + parallax refined in Milestone 3).
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.buildHud();

    // Quick reset for testing (R).
    this.input.keyboard?.on("keydown-R", () => this.respawn());
  }

  override update(_time: number, delta: number): void {
    this.input2.update();
    this.player.updatePlayer(delta, this.input2.getState());

    // Fell out of the world -> respawn (real death handling arrives later).
    if (this.player.y > WORLD_HEIGHT + 64) {
      this.respawn();
    }

    this.updateHud();
  }

  /** Builds platforms, walls, gaps and a high ledge from placeholder rectangles. */
  private buildTestArena(): void {
    this.platforms = this.physics.add.staticGroup();

    const ground = (x: number, w: number) =>
      this.addBox(x, WORLD_HEIGHT - 16, w, 32, 0x5c5346);

    // Ground segments with two gaps (test running off ledges / jumping pits).
    ground(0, 520); // start area
    ground(700, 540); // after first gap
    ground(1400, 600); // after second gap
    ground(2120, 280); // end area

    // Floating platforms at varying heights (test jump arcs & buffering).
    this.addBox(360, 250, 110, 22, 0x8a7f6b);
    this.addBox(560, 195, 110, 22, 0x8a7f6b);
    this.addBox(900, 230, 130, 22, 0x8a7f6b);
    this.addBox(1180, 180, 110, 22, 0x8a7f6b);

    // A stair/step + wall to test turning at walls and short hops.
    this.addBox(1500, WORLD_HEIGHT - 48, 64, 32, 0x6b6253);
    this.addBox(1564, WORLD_HEIGHT - 80, 64, 32, 0x6b6253);
    this.addBox(1628, WORLD_HEIGHT - 112, 24, 64, 0x6b6253);

    // A tall ledge to drop off of — exercises coyote time.
    this.addBox(1950, 150, 150, 22, 0x8a7f6b);
    this.addBox(2025, 240, 24, 180, 0x6b6253);
  }

  /** Adds a static, collidable rectangle and returns it. */
  private addBox(
    x: number,
    y: number,
    w: number,
    h: number,
    color: number
  ): Phaser.GameObjects.Rectangle {
    const rect = this.add.rectangle(x + w / 2, y + h / 2, w, h, color);
    rect.setStrokeStyle(2, 0x000000, 0.25);
    this.physics.add.existing(rect, true);
    this.platforms.add(rect);
    return rect;
  }

  private buildHud(): void {
    const help =
      "Move: ←→ / A D   Jump: Space / W / ↑ (hold = higher)   Sprint: Shift   Reset: R";
    this.add
      .text(8, GAME_HEIGHT - 8, help, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#c0c0d0",
      })
      .setOrigin(0, 1)
      .setScrollFactor(0);

    this.debugText = this.add
      .text(8, 8, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#9be36d",
        backgroundColor: "#00000066",
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0);
  }

  private updateHud(): void {
    const d = this.player.debugInfo;
    this.debugText.setText(
      [
        `FPS:    ${Math.round(this.game.loop.actualFps)}`,
        `vx:     ${d.vx.toFixed(0)}`,
        `vy:     ${d.vy.toFixed(0)}`,
        `ground: ${d.grounded}`,
        `coyote: ${d.coyote.toFixed(0)}ms`,
        `buffer: ${d.buffer.toFixed(0)}ms`,
      ].join("\n")
    );
  }

  private respawn(): void {
    this.player.setPosition(this.spawnPoint.x, this.spawnPoint.y);
    this.player.setVelocity(0, 0);
  }
}
