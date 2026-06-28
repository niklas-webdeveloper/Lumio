import Phaser from "phaser";
import { SceneKeys, TextureKeys } from "@/config/AssetKeys";
import { GAME_WIDTH, GAME_HEIGHT } from "@/config/GameConfig";
import { TileGid } from "@/config/Tiles";
import { getLevel } from "@/config/levels";
import { Player } from "@/entities/Player";
import { Coin } from "@/entities/Coin";
import { Growcap } from "@/entities/powerups/Growcap";
import { LuckyBlock } from "@/entities/blocks/LuckyBlock";
import { BrickBlock } from "@/entities/blocks/BrickBlock";
import {
  Block,
  BlockEvents,
  type LuckyRewardPayload,
  type RewardKind,
} from "@/entities/blocks/Block";
import { InputManager } from "@/systems/InputManager";
import { LevelLoader, type LoadedLevel } from "@/systems/LevelLoader";
import { ParallaxBackground } from "@/systems/ParallaxBackground";
import { CameraManager } from "@/systems/CameraManager";

/** Render depths so gameplay sorts correctly above the parallax background. */
const Depth = {
  terrain: 0,
  block: 1,
  item: 2,
  beacon: 5,
  player: 10,
  ui: 100,
} as const;

/** Coins needed for a bonus life (granted in Milestone 6 alongside the HUD). */
const COINS_PER_LIFE = 100;

/**
 * GameScene: core gameplay.
 *
 * Milestone 4 adds collectible coins, interactive blocks (Lucky/Brick), the
 * Growcap power-up, small↔big player states, and spike-hazard damage on top of
 * the Milestone 3 level/camera/parallax foundation.
 */
export class GameScene extends Phaser.Scene {
  private player!: Player;
  private inputManager!: InputManager;
  private level!: LoadedLevel;
  private parallax!: ParallaxBackground;
  private cameraManager!: CameraManager;

  private coins!: Phaser.GameObjects.Group;
  private blocks!: Phaser.GameObjects.Group;
  private growcaps!: Phaser.GameObjects.Group;

  private coinCount = 0;
  private failed = false;
  private levelComplete = false;
  private debugText!: Phaser.GameObjects.Text;

  constructor() {
    super(SceneKeys.Game);
  }

  create(): void {
    this.coinCount = 0;
    this.failed = false;
    this.levelComplete = false;

    // --- Level geometry ---
    this.level = new LevelLoader().load(this, getLevel(0)!);
    this.level.terrain.setDepth(Depth.terrain);
    this.physics.world.setBounds(0, 0, this.level.widthPx, this.level.heightPx);
    this.physics.world.setBoundsCollision(true, true, true, false); // open bottom

    this.parallax = new ParallaxBackground(this);

    // --- Groups (collision containers; sprites self-add to the scene) ---
    this.coins = this.add.group();
    this.blocks = this.add.group();
    this.growcaps = this.add.group();

    // --- Player ---
    this.inputManager = new InputManager(this);
    this.player = new Player(this, this.level.playerSpawn.x, this.level.playerSpawn.y);
    this.player.setDepth(Depth.player);

    this.spawnLevelObjects();
    this.setupCollisions();
    this.setupRewardEvents();

    this.cameraManager = new CameraManager(
      this,
      this.player,
      this.level.widthPx,
      this.level.heightPx
    );

    this.buildHud();
    this.input.keyboard?.on("keydown-R", () => this.scene.restart());
    this.exposeTestApi();
  }

  override update(_time: number, delta: number): void {
    this.inputManager.update();

    if (!this.failed && !this.levelComplete) {
      this.player.updatePlayer(delta, this.inputManager.getState());
      // Death (hazard/enemy) or falling into a pit both fail the level.
      if (this.player.isDead || this.player.y > this.level.heightPx + 80) {
        this.failLevel();
      }
    }

    this.parallax.update(this.cameraManager.scrollX);
    this.updateHud();
  }

  // ----- Spawning -----

  private spawnLevelObjects(): void {
    for (const obj of this.level.spawns) {
      switch (obj.type) {
        case "coin": {
          const coin = new Coin(this, obj.x, obj.y);
          coin.setDepth(Depth.item);
          this.coins.add(coin);
          break;
        }
        case "luckyblock": {
          const reward = (obj.properties.reward as RewardKind) ?? "coin";
          const block = new LuckyBlock(this, obj.x, obj.y, reward);
          block.setDepth(Depth.block);
          this.blocks.add(block);
          break;
        }
        case "brick": {
          const brick = new BrickBlock(this, obj.x, obj.y);
          brick.setDepth(Depth.block);
          this.blocks.add(brick);
          break;
        }
        case "beacon":
          this.createBeacon(obj.x, obj.y);
          break;
        default:
          break;
      }
    }
  }

  private createBeacon(x: number, y: number): void {
    const beacon = this.physics.add
      .staticSprite(x, y, TextureKeys.Beacon)
      .setOrigin(0.5, 1)
      .setDepth(Depth.beacon);
    beacon.body.updateFromGameObject();
    this.physics.add.overlap(this.player, beacon, () => this.onReachBeacon());
  }

  // ----- Collisions & overlaps -----

  private setupCollisions(): void {
    // Terrain: solid, with spike tiles dealing damage on contact.
    this.physics.add.collider(this.player, this.level.terrain, (_p, tile) => {
      if ((tile as Phaser.Tilemaps.Tile).index === TileGid.Spike) {
        this.damagePlayer();
      }
    });
    this.physics.add.collider(this.growcaps, this.level.terrain);

    // Blocks: solid; a hit from below triggers their behavior.
    this.physics.add.collider(this.player, this.blocks, (_p, b) =>
      this.onBlockCollide(b as Block)
    );
    this.physics.add.collider(this.growcaps, this.blocks);

    // Pickups.
    this.physics.add.overlap(this.player, this.coins, (_p, c) => {
      if ((c as Coin).collect()) this.addCoins(1);
    });
    this.physics.add.overlap(this.player, this.growcaps, (_p, g) =>
      (g as Growcap).applyTo(this.player)
    );
  }

  /** Only a strike from underneath (player's head blocked) activates a block. */
  private onBlockCollide(block: Block): void {
    if (this.player.body.blocked.up && block.y < this.player.y) {
      block.hitFromBelow(this.player);
    }
  }

  private setupRewardEvents(): void {
    // Re-bind cleanly across scene restarts (scene.events persists).
    this.events.off(BlockEvents.LuckyReward, this.onLuckyReward, this);
    this.events.on(BlockEvents.LuckyReward, this.onLuckyReward, this);
  }

  private onLuckyReward(payload: LuckyRewardPayload): void {
    const popY = payload.y - 16; // emerge from the block's top edge
    if (payload.reward === "growcap") {
      const cap = new Growcap(this, payload.x, popY);
      cap.setDepth(Depth.item);
      this.growcaps.add(cap);
    } else {
      this.spawnCoinPop(payload.x, popY);
      this.addCoins(1);
    }
  }

  /** A coin that bursts from a block: arcs up, fades, awards (count handled by caller). */
  private spawnCoinPop(x: number, y: number): void {
    const coin = this.add.image(x, y, TextureKeys.Coin).setDepth(Depth.item);
    this.tweens.add({
      targets: coin,
      y: y - 34,
      alpha: { from: 1, to: 0 },
      duration: 360,
      ease: "Quad.out",
      onComplete: () => coin.destroy(),
    });
  }

  // ----- Player state changes -----

  private damagePlayer(): void {
    const result = this.player.takeDamage();
    if (result === "died") this.failLevel();
  }

  private addCoins(n: number): void {
    this.coinCount += n;
    // 100 coins -> bonus life is wired up with lives/HUD in Milestone 6.
    if (this.coinCount >= COINS_PER_LIFE) this.coinCount -= COINS_PER_LIFE;
  }

  private failLevel(): void {
    if (this.failed) return;
    this.failed = true;
    if (!this.player.isDead) this.player.die();
    this.time.delayedCall(900, () => this.scene.restart());
  }

  private onReachBeacon(): void {
    if (this.levelComplete) return;
    this.levelComplete = true;
    this.player.setVelocity(0, 0);
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

  // ----- HUD (temporary; replaced by UIScene in Milestone 6) -----

  private buildHud(): void {
    this.add
      .text(
        8,
        GAME_HEIGHT - 8,
        "Move ←→/AD  Jump Space/W/↑  Sprint Shift  Restart R",
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
        color: "#ffe08a",
        backgroundColor: "#00000066",
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(Depth.ui);
  }

  private updateHud(): void {
    this.debugText.setText(
      `FPS ${Math.round(this.game.loop.actualFps)}  Coins ${this.coinCount}  Size ${this.player.sizeState}`
    );
  }

  /** Dev-only inspection hooks for the headless smoke tests (stripped in prod). */
  private exposeTestApi(): void {
    if (!import.meta.env.DEV) return;
    (this as unknown as { __test?: unknown }).__test = {
      getCoins: () => this.coinCount,
      getSize: () => this.player.sizeState,
      isDead: () => this.player.isDead,
      isInvuln: () => this.player.isInvulnerable,
      setPlayerPos: (x: number, y: number) => {
        this.player.setPosition(x, y);
        this.player.setVelocity(0, 0);
      },
      growcapCount: () => this.growcaps.getLength(),
      firstGrowcap: () => {
        const g = this.growcaps.getChildren()[0] as
          | Phaser.GameObjects.Sprite
          | undefined;
        return g ? { x: g.x, y: g.y } : null;
      },
      brickCount: () =>
        this.blocks
          .getChildren()
          .filter(
            (c) => (c as Phaser.GameObjects.Sprite).texture.key === TextureKeys.Brick
          ).length,
      damage: () => this.damagePlayer(),
    };
  }
}
