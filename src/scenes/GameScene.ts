import Phaser from "phaser";
import { SceneKeys, TextureKeys } from "@/config/AssetKeys";
import { GAME_WIDTH, GAME_HEIGHT } from "@/config/GameConfig";
import { getLevel } from "@/config/levels";
import { Player } from "@/entities/Player";
import { InputManager } from "@/systems/InputManager";
import { LevelLoader, type LoadedLevel } from "@/systems/LevelLoader";
import { ParallaxBackground } from "@/systems/ParallaxBackground";
import { CameraManager } from "@/systems/CameraManager";

/** Render depths so gameplay sorts correctly above the parallax background. */
const Depth = {
  terrain: 0,
  beacon: 5,
  player: 10,
  ui: 100,
} as const;

/**
 * GameScene: core gameplay.
 *
 * Milestone 3 loads a real Tiled level via LevelLoader, renders the terrain
 * with the generated tileset, sets up a deadzone follow-camera and a multi-layer
 * parallax background, and spawns the player + goal beacon from the object layer.
 */
export class GameScene extends Phaser.Scene {
  private player!: Player;
  private inputManager!: InputManager;
  private level!: LoadedLevel;
  private parallax!: ParallaxBackground;
  private cameraManager!: CameraManager;

  private debugText!: Phaser.GameObjects.Text;
  private levelComplete = false;

  constructor() {
    super(SceneKeys.Game);
  }

  create(): void {
    this.levelComplete = false;

    // --- Build the level from Tiled JSON ---
    this.level = new LevelLoader().load(this, getLevel(0)!);
    this.level.terrain.setDepth(Depth.terrain);

    // World bounds match the level; the bottom is open so pits = a fall to death.
    this.physics.world.setBounds(0, 0, this.level.widthPx, this.level.heightPx);
    this.physics.world.setBoundsCollision(true, true, true, false);

    // --- Background (drawn behind everything) ---
    this.parallax = new ParallaxBackground(this);

    // --- Player ---
    this.inputManager = new InputManager(this);
    this.player = new Player(
      this,
      this.level.playerSpawn.x,
      this.level.playerSpawn.y
    );
    this.player.setDepth(Depth.player);
    this.physics.add.collider(this.player, this.level.terrain);

    // --- Entities from the object layer (beacon for now; more later) ---
    this.spawnLevelObjects();

    // --- Camera ---
    this.cameraManager = new CameraManager(
      this,
      this.player,
      this.level.widthPx,
      this.level.heightPx
    );

    this.buildHud();
    this.input.keyboard?.on("keydown-R", () => this.scene.restart());
  }

  override update(_time: number, delta: number): void {
    this.inputManager.update();

    if (!this.levelComplete) {
      this.player.updatePlayer(delta, this.inputManager.getState());

      // Fell into a pit / below the world -> restart the level (death handling
      // is fleshed out with lives in Milestone 6).
      if (this.player.y > this.level.heightPx + 80) {
        this.scene.restart();
        return;
      }
    }

    this.parallax.update(this.cameraManager.scrollX);
    this.updateHud();
  }

  /** Instantiate non-player objects defined in the level's object layer. */
  private spawnLevelObjects(): void {
    for (const obj of this.level.spawns) {
      switch (obj.type) {
        case "beacon":
          this.createBeacon(obj.x, obj.y);
          break;
        // Future milestones: "coin", "plodder", "snapvine", "luckyblock"…
        default:
          break;
      }
    }
  }

  /** Goal beacon: reaching it completes the level (temporary banner for now). */
  private createBeacon(x: number, y: number): void {
    const beacon = this.physics.add
      .staticSprite(x, y, TextureKeys.Beacon)
      .setOrigin(0.5, 1)
      .setDepth(Depth.beacon);
    // Re-sync the static body after the origin change so it aligns with the art.
    beacon.body.updateFromGameObject();

    this.physics.add.overlap(this.player, beacon, () => this.onReachBeacon());
  }

  private onReachBeacon(): void {
    if (this.levelComplete) return;
    this.levelComplete = true;
    this.player.setVelocity(0, 0);

    // Temporary completion banner; replaced by LevelCompleteScene in Milestone 6.
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "LEVEL COMPLETE!", {
        fontFamily: "monospace",
        fontSize: "28px",
        color: "#9be35a",
        fontStyle: "bold",
        backgroundColor: "#000000aa",
        padding: { x: 14, y: 10 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(Depth.ui);
  }

  private buildHud(): void {
    this.add
      .text(
        8,
        GAME_HEIGHT - 8,
        "Move: ←→/AD   Jump: Space/W/↑ (hold=higher)   Sprint: Shift   Restart: R",
        {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#ffffff",
          backgroundColor: "#00000055",
          padding: { x: 4, y: 2 },
        }
      )
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(Depth.ui);

    this.debugText = this.add
      .text(8, 8, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#9be36d",
        backgroundColor: "#00000066",
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(Depth.ui);
  }

  private updateHud(): void {
    this.debugText.setText(
      `FPS: ${Math.round(this.game.loop.actualFps)}   x:${Math.round(
        this.player.x
      )} y:${Math.round(this.player.y)}`
    );
  }
}
