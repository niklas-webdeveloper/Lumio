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
import { Vulture } from "@/entities/enemies/Vulture";
import { Bat } from "@/entities/enemies/Bat";
import { Icicle } from "@/entities/enemies/Icicle";
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
import { RENDER_SCALE, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/config/GameConfig";
import { LevelLoader, type LoadedLevel } from "@/systems/LevelLoader";
import { decorateTerrain } from "@/systems/Decor";
import { ParallaxBackground } from "@/systems/ParallaxBackground";
import { CameraManager } from "@/systems/CameraManager";
import { ParticleManager } from "@/systems/ParticleManager";
import { gameState, Progression } from "@/systems/GameState";
import { Physics } from "@/config/PhysicsConfig";
import { saveState } from "@/systems/SaveState";
import { audioManager } from "@/systems/AudioManager";
import { fadeIn, fadeOutThen } from "@/systems/transition";
import { ui } from "@/ui/UIManager";

/** Render depths so gameplay sorts correctly above the parallax background. */
const Depth = {
  terrain: 0,
  decor: 0.5, // props on the grass, behind all gameplay objects
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
  private particles!: ParticleManager;

  private coins!: Phaser.GameObjects.Group;
  private blocks!: Phaser.GameObjects.Group;
  private growcaps!: Phaser.GameObjects.Group;
  private enemies!: Phaser.GameObjects.Group;
  private plodders!: Phaser.GameObjects.Group;
  private icicles!: Phaser.GameObjects.Group;
  private pipes!: Phaser.GameObjects.Group;
  private bgm!: Phaser.Sound.BaseSound;

  private failed = false;
  private levelComplete = false;

  // Goal-pole geometry, captured at spawn for the completion slide.
  private beaconFlag?: Phaser.GameObjects.Image;
  private beaconX = 0;
  private beaconTopY = 0;
  private beaconBaseY = 0;

  constructor() {
    super(SceneKeys.Game);
  }

  create(): void {
    this.failed = false;
    this.levelComplete = false;

    // DOM HUD + level title card (the UI layer owns the HUD).
    ui.onGameSceneCreate();

    // --- Level geometry ---
    const level = getLevel(gameState.levelIndex)!;
    this.level = new LevelLoader().load(this, level);
    this.level.terrain.setDepth(Depth.terrain);
    decorateTerrain(this, this.level.terrain, Depth.decor);
    this.physics.world.setBounds(0, 0, this.level.widthPx, this.level.heightPx);
    this.physics.world.setBoundsCollision(true, true, true, false); // open bottom

    this.parallax = new ParallaxBackground(this, level.theme);
    this.particles = new ParticleManager(this);
    fadeIn(this);

    this.coins = this.add.group();
    this.blocks = this.add.group();
    this.growcaps = this.add.group();
    this.enemies = this.add.group();
    this.plodders = this.add.group();
    this.icicles = this.add.group();
    this.pipes = this.add.group();

    this.inputManager = new InputManager(this);
    this.player = new Player(this, this.level.playerSpawn.x, this.level.playerSpawn.y);
    this.player.setDepth(Depth.player);

    this.spawnLevelObjects();
    this.setupCollisions();
    this.setupRewardEvents();

    // Sets up the bounded, target-following gameplay camera (side-effect only).
    new CameraManager(this, this.player, this.level.widthPx, this.level.heightPx);

    gameState.startLevelTimer();
    this.exposeTestApi();

    this.sound.mute = audioManager.isMuted(); // global mute drives the bgm
    this.bgm = this.sound.add(level.music, { loop: true, volume: 0.5 });
    this.bgm.play();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.bgm.stop()
    );
  }

  override update(_time: number, delta: number): void {
    this.inputManager.update();

    if (!this.failed && !this.levelComplete) {
      this.updateSurfaceState();
      this.player.updatePlayer(delta, this.inputManager.getState());

      const fellOut = this.player.y > this.level.heightPx + 80;
      if (this.player.isDead || fellOut) {
        this.handleDeath();
      } else {
        gameState.tickTime(delta); // stopwatch — stops on death/completion
      }
    }

    if (this.cameras?.main) this.parallax.update(this.cameras.main);
    ui.updateHud();
  }

  /**
   * Read the tiles around the player's feet and feed the surface flags into
   * the Player (ice = slippery grip, quicksand = wading/sinking). Also drowns
   * a player whose head goes under the sand.
   */
  private updateSurfaceState(): void {
    const terrain = this.level.terrain;
    const body = this.player.body;

    const under = terrain.getTileAtWorldXY(this.player.x, body.bottom + 2);
    const feet = terrain.getTileAtWorldXY(this.player.x, body.bottom - 1);
    this.player.setSurfaceState({
      ice: under?.index === TileGid.Ice,
      quicksand:
        feet?.index === TileGid.Quicksand ||
        under?.index === TileGid.Quicksand,
    });

    // Fully swallowed: the sand closes well over the player's head (checked
    // a good bit above the hairline so there's real time to hop out first).
    const head = terrain.getTileAtWorldXY(this.player.x, body.top - 14);
    if (head?.index === TileGid.Quicksand) this.damagePlayer();
  }

  // ----- Spawning -----

  private spawnLevelObjects(): void {
    // Collectible total for the "all coins" star: coin spawns + coin blocks.
    let coinTotal = 0;
    for (const obj of this.level.spawns) {
      switch (obj.type) {
        case "coin": {
          const coin = new Coin(this, obj.x, obj.y);
          coin.setDepth(Depth.item);
          this.coins.add(coin);
          coinTotal += 1;
          break;
        }
        case "luckyblock": {
          const reward = (obj.properties.reward as RewardKind) ?? "coin";
          const block = new LuckyBlock(this, obj.x, obj.y, reward);
          block.setDepth(Depth.block);
          this.blocks.add(block);
          if (reward === "coin") coinTotal += 1;
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
        case "vulture": {
          const range = obj.properties.range;
          const vulture = new Vulture(
            this,
            obj.x,
            obj.y,
            typeof range === "number" ? range : undefined
          );
          vulture.setDepth(Depth.enemy);
          this.enemies.add(vulture);
          break;
        }
        case "bat": {
          const bat = new Bat(this, obj.x, obj.y, this.player);
          bat.setDepth(Depth.enemy);
          this.enemies.add(bat);
          break;
        }
        case "icicle": {
          const icicle = new Icicle(this, obj.x, obj.y, this.player);
          icicle.setDepth(Depth.enemy);
          this.enemies.add(icicle);
          this.icicles.add(icicle);
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
    gameState.levelCoinTotal = coinTotal;
  }

  private createBeacon(x: number, y: number): void {
    const beacon = this.physics.add
      .staticSprite(x, y, TextureKeys.Beacon)
      .setOrigin(0.5, 1)
      .setDepth(Depth.beacon);
    beacon.body.updateFromGameObject();
    // Pole geometry for the completion slide (40×200 texture, pole at x 16..21,
    // orb on top, 10px plinth at the bottom).
    this.beaconX = x - 1; // pole centre
    this.beaconTopY = y - 184; // just below the orb
    this.beaconBaseY = y - 10; // top of the plinth
    this.beaconFlag = this.add
      .image(x + 1, this.beaconTopY + 10, TextureKeys.BeaconFlag)
      .setOrigin(0, 0.5)
      .setDepth(Depth.beacon);
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

    // A dropped icicle shatters on whatever ground it hits.
    this.physics.add.collider(this.icicles, this.level.terrain, (ic) => {
      const icicle = ic as unknown as Icicle;
      if (!icicle.isFalling) return;
      this.particles.stompPuff(icicle.x, icicle.y);
      audioManager.play("brick");
      icicle.shatter();
    });

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
    } else if (
      this.player.isGroundPounding &&
      this.player.body.blocked.down &&
      block.y > this.player.y
    ) {
      // Slamming down onto a block triggers it from above (e.g. "?" payout).
      block.hitFromAbove(this.player);
    }
  }

  private onPlayerHitEnemy(enemy: Enemy): void {
    if (this.failed || this.levelComplete || !enemy.canDamage()) return;

    const pb = this.player.body;
    const eb = enemy.body;
    // Judge "from above" by where the player's feet were *last* step, not
    // where they ended up after this step's overlap. A fast fall (e.g. off a
    // high ledge) can move the player many pixels in one step, so checking
    // the current, already-overlapping position would misjudge a slightly
    // off-center — but still on-top — stomp as a side hit.
    const wasAbove = pb.prev.y + pb.height <= eb.top + Physics.STOMP_TOLERANCE_PX;
    const fromAbove = pb.velocity.y > 0 && wasAbove;

    if (fromAbove && enemy.stompable) {
      enemy.stomp();
      this.player.bounce();
      gameState.addScore(Progression.STOMP_SCORE);
      this.particles.stompPuff(enemy.x, eb.bottom);
      // No camera shake on stomp — it happens often and hurt the smooth feel.
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
    this.events.off("player-groundpound-land", this.onGroundPoundLand, this);
    this.events.on("player-groundpound-land", this.onGroundPoundLand, this);
  }

  private onPlayerJump(x: number, y: number): void {
    this.particles.jumpDust(x, y);
  }

  private onGroundPoundLand(x: number, y: number): void {
    this.particles.stompPuff(x, y);
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
    saveState.addTotalCoins(1); // account balance for the character shop
    this.particles.coinSparkle(x, y);
    ui.flyCoinToHud(this.worldToViewport(x, y));
    audioManager.play(extraLife ? "extralife" : "coin");
  }

  /**
   * Map a world position to viewport (CSS pixel) coordinates for the DOM UI.
   * The canvas is stretched to 100vw×100vh with `object-fit: cover`, so the
   * render buffer is scaled by max(vw/bufW, vh/bufH) and center-cropped.
   */
  private worldToViewport(wx: number, wy: number): { x: number; y: number } {
    const view = this.cameras.main.worldView;
    const bufX = (wx - view.x) * RENDER_SCALE;
    const bufY = (wy - view.y) * RENDER_SCALE;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const s = Math.max(vw / CANVAS_WIDTH, vh / CANVAS_HEIGHT);
    return {
      x: vw / 2 + (bufX - CANVAS_WIDTH / 2) * s,
      y: vh / 2 + (bufY - CANVAS_HEIGHT / 2) * s,
    };
  }

  private onBrickBreak(payload: BrickBreakPayload): void {
    this.particles.brickShatter(payload.x, payload.y);
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
      audioManager.play("hurt");
    }
    if (result === "died") this.handleDeath();
  }

  /** Falling/hazard/time death: lose a life, then respawn or end the game. */
  private handleDeath(): void {
    if (this.failed) return;
    this.failed = true;
    if (!this.player.isDead) this.player.die();
    this.bgm.stop();
    audioManager.play("death");

    this.time.delayedCall(DEATH_DELAY, () => {
      const gameOver = gameState.loseLife();
      if (gameOver) {
        fadeOutThen(this, () => ui.showGameOver());
      } else {
        fadeOutThen(this, () => this.scene.restart());
      }
    });
  }

  private onReachBeacon(): void {
    if (this.levelComplete || this.failed) return;
    this.levelComplete = true;
    this.bgm.stop();
    audioManager.play("complete");

    const levelIndex = gameState.levelIndex;
    const level = getLevel(levelIndex)!;
    const timeSec = gameState.timeElapsed;
    const lastLevel = levelIndex >= LEVEL_COUNT - 1;

    // Stars: 1 for the clear, +1 for every coin, +1 for beating the par time.
    const allCoins = gameState.allLevelCoins;
    const underPar = timeSec <= level.parTime;
    const stars = 1 + (allCoins ? 1 : 0) + (underPar ? 1 : 0);

    const bonus = gameState.awardTimeBonus(level.parTime);
    // Per-level records also count in a marathon: the level timer resets on
    // every (re)start, so timeElapsed is a fair single-level clear time.
    const newBestTime = saveState.recordBestTime(levelIndex, timeSec);
    saveState.unlockLevel(Math.min(levelIndex + 1, LEVEL_COUNT - 1));
    saveState.recordLevelStars(levelIndex, stars);
    saveState.recordBestCoins(levelIndex, gameState.levelCoins);
    saveState.recordScore(gameState.score);

    // Marathon: no results screen between levels — flag sequence, then straight
    // into the next level. Only the final level shows the run summary.
    if (gameState.isMarathon && !lastLevel) {
      this.playFlagSequence(() => {
        gameState.advanceLevel();
        fadeOutThen(this, () => this.scene.restart());
      });
      return;
    }

    if (gameState.isMarathon) {
      const runTime = gameState.runTime;
      const runCoins = gameState.runCoins;
      const deaths = gameState.deaths;
      const newBestRun = saveState.recordMarathon(runTime, runCoins, deaths);
      this.playFlagSequence(() => {
        fadeOutThen(this, () =>
          ui.showMarathonComplete({
            timeSec: runTime,
            coins: runCoins,
            deaths,
            newBestRun,
            best: saveState.getBestMarathon(),
          })
        );
      });
      return;
    }

    this.playFlagSequence(() => {
      fadeOutThen(this, () =>
        ui.showComplete({
          bonus,
          lastLevel,
          stars,
          allCoins,
          underPar,
          timeSec,
          bestTime: saveState.getBestTime(levelIndex),
          newBestTime,
          parTime: level.parTime,
          coins: gameState.levelCoins,
          coinTotal: gameState.levelCoinTotal,
        })
      );
    });
  }

  /**
   * Mario-style level end: the player grabs the pole where they hit it,
   * slides to the plinth together with the pennant, hops off, and lands
   * facing onward before the results screen fades in.
   */
  private playFlagSequence(onDone: () => void): void {
    const p = this.player;
    const dir: 1 | -1 = p.x <= this.beaconX ? 1 : -1; // side the player came from
    const feetOffset = p.body.bottom - p.y; // sprite centre → feet distance

    p.beginPoleSlide(dir);
    p.setPosition(
      this.beaconX - dir * 8, // hands on the shaft
      Phaser.Math.Clamp(p.y, this.beaconTopY + 20, this.beaconBaseY - 40)
    );

    const slideY = this.beaconBaseY - feetOffset; // feet end on the plinth
    const slideMs = Phaser.Math.Clamp(((slideY - p.y) / 240) * 1000, 300, 1400);

    // The pennant rides down alongside the player.
    if (this.beaconFlag) {
      this.tweens.add({
        targets: this.beaconFlag,
        y: this.beaconBaseY - 24,
        duration: slideMs,
        ease: "Sine.in",
      });
    }

    this.tweens.add({
      targets: p,
      y: slideY,
      duration: slideMs,
      ease: "Sine.in",
      onComplete: () => {
        this.particles.stompPuff(p.x, this.beaconBaseY);
        this.particles.powerupSparkle(this.beaconX, this.beaconTopY - 12);
        this.time.delayedCall(200, () => this.hopOffPole(dir, onDone));
      },
    });
  }

  /** The little dismount hop from the plinth down to the ground. */
  private hopOffPole(dir: 1 | -1, onDone: () => void): void {
    const p = this.player;
    p.poseHopOff(dir);
    audioManager.play("jump");

    const groundY = p.y + 10; // step off the 10px plinth onto the ground line
    this.tweens.add({ targets: p, x: p.x + dir * 36, duration: 320 });
    this.tweens.add({
      targets: p,
      y: p.y - 22,
      duration: 150,
      ease: "Quad.out",
      onComplete: () => {
        this.tweens.add({
          targets: p,
          y: groundY,
          duration: 190,
          ease: "Quad.in",
          onComplete: () => {
            p.poseLandCelebrate();
            this.particles.jumpDust(p.x, groundY + (p.body.bottom - p.y));
            this.time.delayedCall(COMPLETE_DELAY, onDone);
          },
        });
      },
    });
  }

  /** True if the player asked to pause this frame (P/Esc, handled by the UI). */
  public get canPause(): boolean {
    return !this.failed && !this.levelComplete;
  }

  /** Dev-only inspection hooks for the headless smoke tests (stripped in prod). */
  private exposeTestApi(): void {
    if (!import.meta.env.DEV) return;
    (this as unknown as { __test?: unknown }).__test = {
      getCoins: () => gameState.coins,
      getScore: () => gameState.score,
      getLives: () => gameState.lives,
      getTime: () => gameState.timeElapsed,
      getLevelCoins: () => gameState.levelCoins,
      getLevelCoinTotal: () => gameState.levelCoinTotal,
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
      isCrouching: () => this.player.isCrouching,
      isGroundPounding: () => this.player.isGroundPounding,
      bodyHeight: () => this.player.body.height,
      playerPos: () => ({ x: this.player.x, y: this.player.y }),
      playerAngle: () => this.player.angle,
      jumpsUsed: () => this.player.jumpsUsedCount,
      animKey: () => this.player.anims.currentAnim?.key ?? "",
      levelIndex: () => gameState.levelIndex,
      enemyCount: () => this.enemies.getLength(),
      plodderCount: () => this.plodders.getLength(),
      icicleCount: () => this.icicles.getLength(),
      onIce: () => this.player.isOnIce,
      inQuicksand: () => this.player.isInQuicksand,
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
