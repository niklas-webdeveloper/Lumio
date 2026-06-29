import Phaser from "phaser";
import { SceneKeys, TextureKeys } from "@/config/AssetKeys";
import { TileGid } from "@/config/Tiles";
import { getLevel, LEVEL_COUNT } from "@/config/levels";
import { Player } from "@/entities/Player";
import { Coin } from "@/entities/Coin";
import { Pipe } from "@/entities/Pipe";
import { Growcap } from "@/entities/powerups/Growcap";
import { Enemy } from "@/entities/enemies/Enemy";
import { Plodder } from "@/entities/enemies/Plodder";
import { Snapvine } from "@/entities/enemies/Snapvine";
import { LuckyBlock } from "@/entities/blocks/LuckyBlock";
import { BrickBlock } from "@/entities/blocks/BrickBlock";
import {
  Block,
  BlockEvents,
  type LuckyRewardPayload,
  type BrickBreakPayload,
  type RewardKind,
} from "@/entities/blocks/Block";
import { InputManager } from "@/systems/InputManager";
import { LevelLoader, type LoadedLevel } from "@/systems/LevelLoader";
import { ParallaxBackground } from "@/systems/ParallaxBackground";
import { CameraManager } from "@/systems/CameraManager";
import { ParticleManager } from "@/systems/ParticleManager";
import { gameState, Progression } from "@/systems/GameState";
import { saveState } from "@/systems/SaveState";
import { audioManager } from "@/systems/AudioManager";
import { fadeIn, fadeOutThen } from "@/systems/transition";

/** Render depths so gameplay sorts correctly above the parallax background. */
const Depth = {
  terrain: 0,
  block: 1,
  item: 2,
  plant: 3, // behind the pipe, so a retracted Snapvine is hidden
  beacon: 5,
  pipe: 6,
  enemy: 8, // in front of pipes
  player: 10,
} as const;

/** Delay (ms) before resolving a death or a completed level. */
const DEATH_DELAY = 900;
const COMPLETE_DELAY = 700;

/**
 * GameScene: core gameplay. Loads the level for the current gameState.levelIndex,
 * runs the HUD (UIScene) in parallel, and owns the run-loop concerns: scoring,
 * the countdown timer, lives/death, pausing, and level completion transitions.
 */
export class GameScene extends Phaser.Scene {
  private player!: Player;
  private inputManager!: InputManager;
  private level!: LoadedLevel;
  private parallax!: ParallaxBackground;
  private cameraManager!: CameraManager;
  private particles!: ParticleManager;

  private coins!: Phaser.GameObjects.Group;
  private blocks!: Phaser.GameObjects.Group;
  private growcaps!: Phaser.GameObjects.Group;
  private enemies!: Phaser.GameObjects.Group;
  private plodders!: Phaser.GameObjects.Group;
  private pipes!: Phaser.GameObjects.Group;

  private failed = false;
  private levelComplete = false;
  /** Guards one-time binding of Systems pause/resume events across restarts. */
  private pauseEventsBound = false;

  constructor() {
    super(SceneKeys.Game);
  }

  create(): void {
    this.failed = false;
    this.levelComplete = false;

    // HUD overlay (launched once; survives level restarts).
    if (!this.scene.isActive(SceneKeys.UI)) this.scene.launch(SceneKeys.UI);

    // --- Level geometry ---
    this.level = new LevelLoader().load(this, getLevel(gameState.levelIndex)!);
    this.level.terrain.setDepth(Depth.terrain);
    this.physics.world.setBounds(0, 0, this.level.widthPx, this.level.heightPx);
    this.physics.world.setBoundsCollision(true, true, true, false); // open bottom

    this.parallax = new ParallaxBackground(this);
    this.particles = new ParticleManager(this);
    fadeIn(this);

    this.coins = this.add.group();
    this.blocks = this.add.group();
    this.growcaps = this.add.group();
    this.enemies = this.add.group();
    this.plodders = this.add.group();
    this.pipes = this.add.group();

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

    gameState.startLevelTimer();
    this.setupPauseControls();
    this.exposeTestApi();

    audioManager.startMusic();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      audioManager.stopMusic()
    );
  }

  override update(_time: number, delta: number): void {
    this.inputManager.update();

    if (!this.failed && !this.levelComplete) {
      this.player.updatePlayer(delta, this.inputManager.getState());

      const fellOut = this.player.y > this.level.heightPx + 80;
      if (this.player.isDead || fellOut) {
        this.handleDeath();
      } else if (gameState.tickTime(delta)) {
        this.handleDeath(); // time ran out
      }
    }

    this.parallax.update(this.cameraManager.scrollX);
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
        case "plodder": {
          const plodder = new Plodder(this, obj.x, obj.y, this.level.terrain);
          plodder.setDepth(Depth.enemy);
          this.enemies.add(plodder);
          this.plodders.add(plodder);
          break;
        }
        case "pipe": {
          const pipe = new Pipe(this, obj.x, obj.y);
          pipe.setDepth(Depth.pipe);
          this.pipes.add(pipe);
          if (obj.properties.plant === true) {
            const plant = new Snapvine(this, pipe.mouthX, pipe.mouthY);
            plant.setDepth(Depth.plant);
            this.enemies.add(plant);
          }
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
    this.physics.add.collider(this.player, this.level.terrain, (_p, tile) => {
      if ((tile as Phaser.Tilemaps.Tile).index === TileGid.Spike) {
        this.damagePlayer();
      }
    });
    this.physics.add.collider(this.growcaps, this.level.terrain);

    this.physics.add.collider(this.player, this.blocks, (_p, b) =>
      this.onBlockCollide(b as Block)
    );
    this.physics.add.collider(this.growcaps, this.blocks);

    this.physics.add.collider(this.player, this.pipes);
    this.physics.add.collider(this.growcaps, this.pipes);
    this.physics.add.collider(this.plodders, this.level.terrain);
    this.physics.add.collider(this.plodders, this.blocks);
    this.physics.add.collider(this.plodders, this.pipes);

    this.physics.add.overlap(this.player, this.coins, (_p, c) => {
      const coin = c as Coin;
      if (coin.collect()) this.collectCoin(coin.x, coin.y);
    });
    this.physics.add.overlap(this.player, this.growcaps, (_p, g) => {
      const cap = g as Growcap;
      this.particles.powerupSparkle(cap.x, cap.y);
      audioManager.play("powerup");
      cap.applyTo(this.player);
    });
    this.physics.add.overlap(this.player, this.enemies, (_p, e) =>
      this.onPlayerHitEnemy(e as Enemy)
    );
  }

  private onBlockCollide(block: Block): void {
    if (this.player.body.blocked.up && block.y < this.player.y) {
      block.hitFromBelow(this.player);
    }
  }

  private onPlayerHitEnemy(enemy: Enemy): void {
    if (this.failed || this.levelComplete || !enemy.canDamage()) return;

    const pb = this.player.body;
    const eb = enemy.body;
    const fromAbove = pb.velocity.y > 0 && pb.bottom <= eb.top + 8;

    if (fromAbove && enemy.stompable) {
      enemy.stomp();
      this.player.bounce();
      gameState.addScore(Progression.STOMP_SCORE);
      this.particles.stompPuff(enemy.x, eb.bottom);
      this.cameraManager.shake();
      audioManager.play("stomp");
    } else {
      this.damagePlayer();
    }
  }

  private setupRewardEvents(): void {
    this.events.off(BlockEvents.LuckyReward, this.onLuckyReward, this);
    this.events.on(BlockEvents.LuckyReward, this.onLuckyReward, this);
    this.events.off(BlockEvents.BrickBreak, this.onBrickBreak, this);
    this.events.on(BlockEvents.BrickBreak, this.onBrickBreak, this);
    // Player jump effects (emitted by Player so particles stay in the scene).
    this.events.off("player-jump", this.onPlayerJump, this);
    this.events.on("player-jump", this.onPlayerJump, this);
    this.events.off("player-doublejump", this.onPlayerDoubleJump, this);
    this.events.on("player-doublejump", this.onPlayerDoubleJump, this);
  }

  private onPlayerJump(x: number, y: number): void {
    this.particles.jumpDust(x, y);
  }

  private onPlayerDoubleJump(x: number, y: number): void {
    this.particles.doubleJumpBurst(x, y);
  }

  private onLuckyReward(payload: LuckyRewardPayload): void {
    const popY = payload.y - 16;
    if (payload.reward === "growcap") {
      const cap = new Growcap(this, payload.x, popY);
      cap.setDepth(Depth.item);
      this.growcaps.add(cap);
    } else {
      this.spawnCoinPop(payload.x, popY);
      this.collectCoin(payload.x, popY);
    }
  }

  /** Award a coin with sparkle + sound, voicing a fanfare on a bonus life. */
  private collectCoin(x: number, y: number): void {
    const { extraLife } = gameState.addCoin();
    this.particles.coinSparkle(x, y);
    audioManager.play(extraLife ? "extralife" : "coin");
  }

  private onBrickBreak(payload: BrickBreakPayload): void {
    this.particles.brickShatter(payload.x, payload.y);
    this.cameraManager.shake(90, 0.004);
    audioManager.play("brick");
  }

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

  // ----- Run-loop concerns -----

  private damagePlayer(): void {
    const result = this.player.takeDamage();
    if (result === "shrank") {
      this.cameraManager.shake(120, 0.006);
      audioManager.play("hurt");
    }
    if (result === "died") this.handleDeath();
  }

  /** Falling/hazard/time death: lose a life, then respawn or end the game. */
  private handleDeath(): void {
    if (this.failed) return;
    this.failed = true;
    if (!this.player.isDead) this.player.die();
    this.cameraManager.shake(250, 0.01);
    audioManager.stopMusic();
    audioManager.play("death");

    this.time.delayedCall(DEATH_DELAY, () => {
      const gameOver = gameState.loseLife();
      if (gameOver) {
        saveState.recordScore(gameState.score);
        fadeOutThen(this, () => {
          this.scene.stop(SceneKeys.UI);
          this.scene.start(SceneKeys.GameOver);
        });
      } else {
        fadeOutThen(this, () => this.scene.restart());
      }
    });
  }

  private onReachBeacon(): void {
    if (this.levelComplete || this.failed) return;
    this.levelComplete = true;
    this.player.setVelocity(0, 0);
    audioManager.stopMusic();
    audioManager.play("complete");

    const bonus = gameState.awardTimeBonus();
    const lastLevel = gameState.levelIndex >= LEVEL_COUNT - 1;
    saveState.unlockLevel(Math.min(gameState.levelIndex + 1, LEVEL_COUNT - 1));
    saveState.recordScore(gameState.score);

    this.time.delayedCall(COMPLETE_DELAY, () => {
      fadeOutThen(this, () => {
        this.scene.stop(SceneKeys.UI);
        this.scene.start(SceneKeys.LevelComplete, { bonus, lastLevel });
      });
    });
  }

  // ----- Pause -----

  private setupPauseControls(): void {
    const pause = () => {
      if (this.failed || this.levelComplete) return;
      this.scene.launch(SceneKeys.Pause);
      this.scene.pause();
    };
    // Keyboard listeners are cleared on scene shutdown, so re-add every create.
    this.input.keyboard?.on("keydown-P", pause);
    this.input.keyboard?.on("keydown-ESC", pause);
    this.input.keyboard?.on("keydown-M", () => audioManager.toggleMute());

    // Disable this scene's keys while paused so the pause/resume keys don't
    // double-fire across the two scenes. Systems events persist across restarts,
    // so bind these only once; read the (recreated) keyboard plugin lazily.
    if (!this.pauseEventsBound) {
      this.pauseEventsBound = true;
      this.events.on(Phaser.Scenes.Events.PAUSE, () => {
        if (this.input.keyboard) this.input.keyboard.enabled = false;
      });
      this.events.on(Phaser.Scenes.Events.RESUME, () => {
        if (this.input.keyboard) this.input.keyboard.enabled = true;
      });
    }
  }

  /** Dev-only inspection hooks for the headless smoke tests (stripped in prod). */
  private exposeTestApi(): void {
    if (!import.meta.env.DEV) return;
    (this as unknown as { __test?: unknown }).__test = {
      getCoins: () => gameState.coins,
      getScore: () => gameState.score,
      getLives: () => gameState.lives,
      getTime: () => gameState.timeLeft,
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
      grow: () => this.player.grow(),
      playerVy: () => this.player.body.velocity.y,
      playerPos: () => ({ x: this.player.x, y: this.player.y }),
      playerAngle: () => this.player.angle,
      jumpsUsed: () => this.player.jumpsUsedCount,
      animKey: () => this.player.anims.currentAnim?.key ?? "",
      levelIndex: () => gameState.levelIndex,
      enemyCount: () => this.enemies.getLength(),
      plodderCount: () => this.plodders.getLength(),
      plodderList: () =>
        this.plodders
          .getChildren()
          .map((p) => ({ x: (p as Plodder).x, y: (p as Plodder).y })),
      hasSnapvine: () =>
        this.enemies.getChildren().some((e) => (e as Enemy).stompable === false),
      snapvineCanDamage: () =>
        this.enemies
          .getChildren()
          .some(
            (e) => (e as Enemy).stompable === false && (e as Enemy).canDamage()
          ),
    };
  }
}
