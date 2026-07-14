import Phaser from "phaser";
import { SceneKeys, TextureKeys } from "@/config/AssetKeys";
import { TileGid } from "@/config/Tiles";
import { getLevel, LEVEL_COUNT, MARATHON_LEVEL_COUNT, type BossId } from "@/config/levels";
import { Player } from "@/entities/Player";
import { Coin } from "@/entities/Coin";
import { Pipe } from "@/entities/Pipe";
import { Growcap } from "@/entities/powerups/Growcap";
import { ItemPickup } from "@/entities/powerups/ItemPickup";
import { Fireball } from "@/entities/Fireball";
import { Enemy } from "@/entities/enemies/Enemy";
import { Boss, BossEvents } from "@/entities/enemies/bosses/Boss";
import { MonarchBoss } from "@/entities/enemies/bosses/MonarchBoss";
import { KrakenBoss } from "@/entities/enemies/bosses/KrakenBoss";
import { BossOrb } from "@/entities/enemies/bosses/BossOrb";
import { Tentacle } from "@/entities/enemies/bosses/Tentacle";
import { ShadowBeast } from "@/entities/enemies/ShadowBeast";
import { BOSS_NAMES } from "@/config/bossArt";
import { Plodder } from "@/entities/enemies/Plodder";
import { ShadowSoldier } from "@/entities/enemies/ShadowSoldier";
import { LavaGolem } from "@/entities/enemies/LavaGolem";
import { Phoenix } from "@/entities/enemies/Phoenix";
import { Snapvine } from "@/entities/enemies/Snapvine";
import { Frog } from "@/entities/enemies/Frog";
import { Vulture } from "@/entities/enemies/Vulture";
import { Bat } from "@/entities/enemies/Bat";
import { Icicle } from "@/entities/enemies/Icicle";
import { LuckyBlock } from "@/entities/blocks/LuckyBlock";
import { ItemBlock } from "@/entities/blocks/ItemBlock";
import { BrickBlock } from "@/entities/blocks/BrickBlock";
import {
  Block,
  BlockEvents,
  type LuckyRewardPayload,
  type BrickBreakPayload,
} from "@/entities/blocks/Block";
import { InputManager } from "@/systems/InputManager";
import {
  RENDER_SCALE,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GAME_WIDTH,
  GAME_HEIGHT,
} from "@/config/GameConfig";
import { LevelLoader, type LoadedLevel } from "@/systems/LevelLoader";
import { decorateTerrain } from "@/systems/Decor";
import { pipeKeyFor, snapvineTintFor, brickTintFor } from "@/config/themedArt";
import { ParallaxBackground } from "@/systems/ParallaxBackground";
import { CameraManager } from "@/systems/CameraManager";
import { ParticleManager } from "@/systems/ParticleManager";
import { gameState, Progression } from "@/systems/GameState";
import type { BgTheme } from "@/config/backgrounds";
import { Physics } from "@/config/PhysicsConfig";
import { saveState } from "@/systems/SaveState";
import { FX_SHEETS, FX_ANIMS } from "@/config/characterAssets";
import { ghostStore, GhostRecorder, GhostPlayer } from "@/systems/Ghost";
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
  boss: 8.5, // arena boss, in front of its minions
  ghost: 9.5, // best-run replay, just behind the live player
  player: 10,
  water: 11, // translucent water overlay — the player reads as submerged
} as const;

/** Max simultaneously alive summoned minions in a boss arena. */
const BOSS_MINION_CAP = 2;
/** Score for felling a boss. */
const BOSS_SCORE = 1000;

/** Delay (ms) before resolving a death or a completed level. */
const DEATH_DELAY = 900;
const COMPLETE_DELAY = 700;

/** Star item: on-demand invincibility duration (ms). */
const STAR_DURATION_MS = 5000;
/** Fire-burst item: number of mini fireballs per use and gap between shots. */
const FIREBURST_SHOTS = 5;
const FIREBURST_GAP_MS = 90;

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
  private itemPickups!: Phaser.GameObjects.Group;
  private fireballs!: Phaser.GameObjects.Group;
  private enemies!: Phaser.GameObjects.Group;
  private plodders!: Phaser.GameObjects.Group;
  private icicles!: Phaser.GameObjects.Group;
  private pipes!: Phaser.GameObjects.Group;
  private bgm?: Phaser.Sound.BaseSound;
  /** Warp pipes (enter with ↓ while standing on the mouth) and their targets. */
  private warpPipes: Array<{ pipe: Pipe; target: string }> = [];
  /** Named warp destinations ("warppoint" spawns), e.g. the bonus room. */
  private warpPoints = new Map<string, Phaser.Math.Vector2>();
  /** True during the enter-pipe / teleport / emerge sequence. */
  private warping = false;
  /** Current level's theme — selects themed enemies for generic spawns. */
  private theme!: BgTheme;
  /** Drifting soul-fire / ember motes on the themed stages (follows the view). */
  private ambientMotes?: Phaser.GameObjects.Particles.ParticleEmitter;
  /** Swimmable water zones (Tropic Lagoon) — world-space rects. */
  private waterZones: Phaser.Geom.Rectangle[] = [];
  /** Records this run for the ghost replay (classic mode only). */
  private ghostRecorder?: GhostRecorder;
  /** Plays back the stored best run as a translucent ghost. */
  private ghost?: GhostPlayer;
  /** The arena boss (boss stages only). */
  private boss?: Boss;
  /** Boss projectiles (pop on terrain and on the player). */
  private bossOrbs!: Phaser.GameObjects.Group;
  /** Boss area hazards (tentacles) — overlap-only, no terrain collision. */
  private bossZones!: Phaser.GameObjects.Group;

  private failed = false;
  private levelComplete = false;
  /** Next time star-power contact may chip the boss (slow tick gate). */
  private starStrikeAt = 0;
  /** Contact grace after bouncing off the boss: the leftover overlap of the
   *  very next frames must not count as a side hit against the player. */
  private bossContactGraceUntil = 0;

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
    this.warping = false;
    this.warpPipes = [];
    this.warpPoints.clear();
    this.waterZones = [];
    this.ghost = undefined;
    this.boss = undefined;
    this.starStrikeAt = 0;
    this.bossContactGraceUntil = 0;

    // DOM HUD + level title card (the UI layer owns the HUD).
    ui.onGameSceneCreate();

    // --- Level geometry ---
    const level = getLevel(gameState.levelIndex)!;
    this.theme = level.theme;
    this.level = new LevelLoader().load(this, level);
    this.level.terrain.setDepth(Depth.terrain);
    decorateTerrain(this, this.level.terrain, Depth.decor, level.theme);
    this.physics.world.setBounds(0, 0, this.level.widthPx, this.level.heightPx);
    this.physics.world.setBoundsCollision(true, true, true, false); // open bottom

    this.parallax = new ParallaxBackground(this, level.theme);
    this.particles = new ParticleManager(this);
    this.startAmbientMotes(level.theme);
    fadeIn(this);

    this.coins = this.add.group();
    this.blocks = this.add.group();
    this.growcaps = this.add.group();
    this.itemPickups = this.add.group();
    this.fireballs = this.add.group();
    this.enemies = this.add.group();
    this.plodders = this.add.group();
    this.icicles = this.add.group();
    this.pipes = this.add.group();
    this.bossOrbs = this.add.group();
    this.bossZones = this.add.group();

    this.inputManager = new InputManager(this);
    this.player = new Player(this, this.level.playerSpawn.x, this.level.playerSpawn.y);
    this.player.setDepth(Depth.player);

    this.spawnLevelObjects();
    this.setupCollisions();
    this.setupRewardEvents();

    // Sets up the bounded, target-following gameplay camera (side-effect only).
    new CameraManager(this, this.player, this.level.widthPx, this.level.heightPx);

    // The follow-lerp moves the camera in preRender, *after* the scene update.
    // Repositioning the parallax only in update() therefore lagged one frame
    // behind the camera, exposing a jittering strip of background color at the
    // leading screen edge while running. FOLLOW_UPDATE fires right after the
    // camera has settled on its final scroll for the frame — realign there.
    this.cameras.main.on(Phaser.Cameras.Scene2D.Events.FOLLOW_UPDATE, () => {
      this.parallax.update(this.cameras.main);
      // Keep the ambient mote field parked over the visible view.
      if (this.ambientMotes) {
        const v = this.cameras.main.worldView;
        this.ambientMotes.setPosition(v.x, v.y);
      }
    });

    gameState.startLevelTimer();
    this.setupGhost();
    this.exposeTestApi();

    this.sound.mute = audioManager.isMuted(); // global mute drives the bgm
    // 0.35 balances the loud mastered tracks against the soft synth menu loop.
    // Levels without a soundtrack yet (music: "") simply run silent.
    if (level.music && this.cache.audio.exists(level.music)) {
      this.bgm = this.sound.add(level.music, { loop: true, volume: 0.35 });
      this.bgm.play();
    } else {
      this.bgm = undefined;
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.bgm?.stop()
    );
  }

  override update(_time: number, delta: number): void {
    this.inputManager.update();

    if (!this.failed && !this.levelComplete && !this.warping) {
      this.updateSurfaceState();
      this.player.updatePlayer(delta, this.inputManager.getState());
      if (this.inputManager.getState().useItemJustPressed) this.useHeldItem();
      if (this.inputManager.getState().downJustPressed) this.tryEnterWarpPipe();
      ui.setSpecialCooldown(this.player.specialCooldownFrac);

      const fellOut = this.player.y > this.level.heightPx + 80;
      if (this.player.isDead || fellOut) {
        this.handleDeath();
      } else {
        gameState.tickTime(delta); // stopwatch — stops on death/completion
        this.updateGhost();
      }
    } else if (this.warping) {
      gameState.tickTime(delta); // the detour still costs run time
    }

    // The parallax realigns on FOLLOW_UPDATE (after the camera settles) — no
    // second update() call here, that would just do the same work twice.
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

    // Water: the body counts as swimming once its centre is inside a zone.
    let water: Phaser.Geom.Rectangle | null = null;
    for (const zone of this.waterZones) {
      if (zone.contains(this.player.x, body.center.y)) {
        water = zone;
        break;
      }
    }

    this.player.setSurfaceState({
      ice: under?.index === TileGid.Ice,
      quicksand:
        feet?.index === TileGid.Quicksand ||
        under?.index === TileGid.Quicksand,
      water: water !== null,
      waterSurfaceY: water?.y ?? 0,
      waterBottomY: water ? water.bottom : 0,
    });

    // Fully swallowed: the sand closes well over the player's head (checked
    // a good bit above the hairline so there's real time to hop out first).
    const head = terrain.getTileAtWorldXY(this.player.x, body.top - 14);
    if (head?.index === TileGid.Quicksand) this.damagePlayer();
  }

  /**
   * Drifting glowing motes across the view on the two anime stages: cold
   * soul-fire on the Shadow stage, rising embers on the Crimson stage. The
   * emitter lives in world space and is re-parked over the camera view every
   * frame (see the FOLLOW_UPDATE hook), so the field always fills the screen.
   */
  private startAmbientMotes(theme: BgTheme): void {
    if (theme !== "shadow" && theme !== "crimson" && theme !== "lagoon") return;
    const shadow = theme === "shadow";
    const lagoon = theme === "lagoon";
    this.ambientMotes = this.add
      .particles(0, 0, TextureKeys.Spark, {
        lifespan: lagoon ? 5200 : 4200,
        speedX: lagoon ? { min: -14, max: 14 } : { min: -8, max: 8 },
        // Lagoon fireflies meander; the other stages' motes drift upward.
        speedY: lagoon
          ? { min: -8, max: 8 }
          : shadow
            ? { min: -20, max: -6 }
            : { min: -30, max: -12 },
        scale: { min: 0.14, max: lagoon ? 0.38 : 0.5 },
        alpha: { start: lagoon ? 0.55 : shadow ? 0.5 : 0.65, end: 0 },
        tint: lagoon
          ? [0xaff77a, 0xfff2a8, 0x7ae8c8]
          : shadow
            ? [0x6ad7ff, 0x9a7bff, 0xbfe6ff]
            : [0xff7a2a, 0xff3a1e, 0xffc24e],
        blendMode: Phaser.BlendModes.ADD,
        frequency: lagoon ? 240 : shadow ? 190 : 150,
        quantity: 1,
        emitZone: {
          type: "random" as const,
          source: new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT),
          quantity: 1,
        },
      })
      .setDepth(4);
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
          // Rewards are random now, so block coins are a bonus and no longer
          // count toward the "all coins" star goal.
          const block = new LuckyBlock(this, obj.x, obj.y);
          block.setDepth(Depth.block);
          this.blocks.add(block);
          break;
        }
        case "itemblock": {
          // Boss-arena supply: always a combat item, re-arms after a while.
          const block = new ItemBlock(this, obj.x, obj.y);
          block.setDepth(Depth.block);
          this.blocks.add(block);
          break;
        }
        case "brick": {
          const brick = new BrickBlock(this, obj.x, obj.y);
          brick.setDepth(Depth.block);
          const tint = brickTintFor(this.theme);
          if (tint !== undefined) brick.setTint(tint);
          this.blocks.add(brick);
          break;
        }
        case "plodder": {
          // The ground grunt is reskinned per theme: a Shadow-Monarch knight on
          // level 5, a lava golem on level 6. Same patrol/stomp AI (WalkerEnemy).
          const walker =
            this.theme === "shadow"
              ? new ShadowSoldier(this, obj.x, obj.y, this.level.terrain)
              : this.theme === "crimson"
                ? new LavaGolem(this, obj.x, obj.y, this.level.terrain)
                : new Plodder(this, obj.x, obj.y, this.level.terrain);
          walker.setDepth(Depth.enemy);
          this.enemies.add(walker);
          this.plodders.add(walker);
          break;
        }
        case "vulture": {
          const range = obj.properties.range;
          const rangePx = typeof range === "number" ? range : undefined;
          // The crimson stage soars fiery phoenixes instead of vultures.
          const flyer =
            this.theme === "crimson"
              ? new Phoenix(this, obj.x, obj.y, rangePx)
              : new Vulture(this, obj.x, obj.y, rangePx);
          flyer.setDepth(Depth.enemy);
          this.enemies.add(flyer);
          break;
        }
        case "bat": {
          const bat = new Bat(this, obj.x, obj.y, this.player);
          bat.setDepth(Depth.enemy);
          this.enemies.add(bat);
          break;
        }
        case "frog": {
          // Lagoon hopper: arcs toward the player instead of pacing.
          const frog = new Frog(this, obj.x, obj.y, this.player);
          frog.setDepth(Depth.enemy);
          this.enemies.add(frog);
          this.plodders.add(frog); // rides the ground-walker colliders
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
          // The plant-housing pipe is reskinned per theme (arcane stone conduit
          // / obsidian vent) and the emerging plant tinted to match.
          const pipe = new Pipe(this, obj.x, obj.y, pipeKeyFor(this.theme));
          pipe.setDepth(Depth.pipe);
          this.pipes.add(pipe);
          if (obj.properties.plant === true) {
            const plant = new Snapvine(this, pipe.mouthX, pipe.mouthY);
            plant.setDepth(Depth.plant);
            const tint = snapvineTintFor(this.theme);
            if (tint !== undefined) plant.setTint(tint);
            this.enemies.add(plant);
          }
          break;
        }
        case "warppipe": {
          // A special pipe the player can enter (↓ on the mouth) to warp to a
          // named "warppoint" — e.g. down into the bonus room and back out.
          const pipe = new Pipe(this, obj.x, obj.y, pipeKeyFor(this.theme));
          pipe.setDepth(Depth.pipe);
          this.pipes.add(pipe);
          this.warpPipes.push({
            pipe,
            target: String(obj.properties.target ?? ""),
          });
          this.addWarpSparkle(pipe);
          break;
        }
        case "warppoint":
          this.warpPoints.set(
            obj.name,
            new Phaser.Math.Vector2(obj.x, obj.y)
          );
          break;
        case "boss":
          // Boss stages: the boss replaces the goal pole — defeating it
          // completes the level (see onBossDefeated).
          this.spawnBoss(String(obj.properties.kind ?? ""), obj.x, obj.y);
          break;
        case "water":
          // Swimmable zone: physics rect + the translucent lagoon visuals.
          this.addWaterZone(
            new Phaser.Geom.Rectangle(obj.x, obj.y, obj.width, obj.height)
          );
          break;
        case "beacon":
          this.createBeacon(obj.x, obj.y);
          break;
        default:
          break;
      }
    }
    gameState.levelCoinTotal = coinTotal;
  }

  /**
   * A swimmable water zone: the physics rect plus its visuals — a translucent
   * teal body drawn OVER the player (so swimmers read as submerged), a
   * shimmering surface line, and a lazy field of rising bubbles.
   */
  private addWaterZone(rect: Phaser.Geom.Rectangle): void {
    this.waterZones.push(rect);

    // Water body: two stacked tints fake a light-to-deep gradient.
    this.add
      .rectangle(rect.x, rect.y, rect.width, rect.height * 0.45, 0x2ea8c9, 0.3)
      .setOrigin(0, 0)
      .setDepth(Depth.water);
    this.add
      .rectangle(
        rect.x,
        rect.y + rect.height * 0.45,
        rect.width,
        rect.height * 0.55,
        0x14688f,
        0.42
      )
      .setOrigin(0, 0)
      .setDepth(Depth.water);

    // Surface line: a bright strip whose alpha breathes like lapping water.
    const surface = this.add
      .rectangle(rect.x, rect.y - 1, rect.width, 3, 0xbdf2ff, 0.75)
      .setOrigin(0, 0)
      .setDepth(Depth.water + 0.1);
    this.tweens.add({
      targets: surface,
      alpha: { from: 0.75, to: 0.35 },
      scaleY: { from: 1, to: 1.8 },
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });

    // Ambient bubbles drifting up through the zone.
    this.add
      .particles(0, 0, TextureKeys.Spark, {
        lifespan: 2600,
        speedY: { min: -26, max: -12 },
        speedX: { min: -6, max: 6 },
        scale: { start: 0.28, end: 0.08 },
        alpha: { start: 0.5, end: 0 },
        tint: [0xdffaff, 0x9be4ff],
        blendMode: Phaser.BlendModes.ADD,
        frequency: 420,
        quantity: 1,
        emitZone: {
          type: "random" as const,
          source: new Phaser.Geom.Rectangle(
            rect.x,
            rect.y + 10,
            rect.width,
            Math.max(4, rect.height - 14)
          ),
          quantity: 1,
        },
      })
      .setDepth(Depth.water + 0.2);
  }

  /** A soft golden sparkle over a warp pipe's mouth marks it as enterable. */
  private addWarpSparkle(pipe: Pipe): void {
    this.add
      .particles(pipe.mouthX, pipe.mouthY - 4, TextureKeys.Spark, {
        lifespan: 900,
        speedY: { min: -34, max: -14 },
        speedX: { min: -10, max: 10 },
        scale: { start: 0.35, end: 0 },
        alpha: { start: 0.8, end: 0 },
        tint: [0xffd95e, 0xfff2a8],
        blendMode: Phaser.BlendModes.ADD,
        frequency: 130,
        quantity: 1,
        emitZone: {
          type: "random" as const,
          source: new Phaser.Geom.Rectangle(-22, 0, 44, 4),
          quantity: 1,
        },
      })
      .setDepth(Depth.pipe + 0.5);
  }

  /**
   * ↓ pressed: if the player is standing on a warp pipe's mouth, play the
   * classic sink-into-the-pipe sequence, fade, teleport to the pipe's named
   * warppoint (e.g. the bonus room), and fade back in.
   */
  private tryEnterWarpPipe(): void {
    if (!this.player.body.blocked.down) return;
    for (const { pipe, target } of this.warpPipes) {
      const onMouth =
        Math.abs(this.player.x - pipe.mouthX) <= 20 &&
        Math.abs(this.player.body.bottom - pipe.mouthY) <= 8;
      if (!onMouth) continue;
      const dest = this.warpPoints.get(target);
      if (!dest) continue;
      this.warpTo(dest);
      return;
    }
  }

  private warpTo(dest: Phaser.Math.Vector2): void {
    this.warping = true;
    this.player.setVelocity(0, 0);
    this.player.body.enable = false; // no physics while inside the pipe
    this.player.setDepth(Depth.plant); // sink behind the pipe sprite
    audioManager.play("powerup");

    // Slide down into the pipe, then fade-cut to the destination.
    this.tweens.add({
      targets: this.player,
      y: this.player.y + 44,
      duration: 380,
      ease: "Sine.in",
      onComplete: () => {
        fadeOutThen(this, () => {
          this.player.setPosition(dest.x, dest.y);
          this.player.setDepth(Depth.player);
          this.player.body.enable = true;
          this.player.setVelocity(0, 0);
          // Snap the camera so the fade-in opens on the destination (the
          // follow-lerp would otherwise pan across the whole level).
          this.cameras.main.centerOn(dest.x, dest.y);
          fadeIn(this);
          this.warping = false;
        });
      },
    });
  }

  // ----- Boss stages -----

  /**
   * Spawn the arena boss (boss stages only). The boss replaces the goal pole:
   * its defeat completes the level. All cross-cutting concerns (HUD bar,
   * minions, FX, victory) run over scene events — see setupBossWiring.
   */
  private spawnBoss(kind: string, x: number, y: number): void {
    const level = getLevel(gameState.levelIndex)!;
    const id = (kind || level.boss || "") as BossId;
    if (id === "monarch") {
      this.boss = new MonarchBoss(this, x, y, {
        player: this.player,
        orbs: this.bossOrbs,
      });
      this.physics.add.collider(this.boss, this.level.terrain);
    } else if (id === "kraken") {
      // The pool the Kraken lurks in is the arena's (only) water zone.
      const pool = this.waterZones[0];
      const shoreTopY = pool ? pool.y - 8 : y - 64;
      this.boss = new KrakenBoss(this, x, y, {
        player: this.player,
        orbs: this.bossOrbs,
        zones: this.bossZones,
        // Tentacles root on the GROUND, never on the raised ledges/plank —
        // scanning below the shore line keeps those perches genuinely safe.
        groundYAt: (gx) => this.groundYAt(gx, shoreTopY + 2),
        poolLeft: pool ? pool.x : x - 120,
        poolRight: pool ? pool.right : x + 120,
        shoreTopY,
      });
    } else {
      return;
    }
    this.boss.setDepth(Depth.boss);
    ui.showBossBar(BOSS_NAMES[id]);
    this.setupBossWiring();
  }

  /** Overlaps + scene events for the boss fight (idempotent across restarts). */
  private setupBossWiring(): void {
    const boss = this.boss!;
    this.physics.add.overlap(this.player, boss, () => this.onPlayerTouchBoss());
    // Player fireballs: an item hit — connects any time (strike i-frames
    // keep a whole volley from melting the bar in one burst).
    this.physics.add.overlap(this.fireballs, boss, (f) => {
      const ball = f as Fireball;
      if (ball.isDone || boss.isDying) return;
      ball.explode();
      if (!boss.strike(1)) audioManager.play("clank");
    });
    // Boss projectiles: die on terrain, hurt the player on contact.
    this.physics.add.collider(this.bossOrbs, this.level.terrain, (o) =>
      (o as BossOrb).pop()
    );
    this.physics.add.overlap(this.player, this.bossOrbs, (_p, o) => {
      const orb = o as BossOrb;
      if (orb.isDone || this.player.isDashing) return;
      orb.pop();
      this.damagePlayer();
    });
    // Tentacles hurt only while they're actually out (not during the warning).
    this.physics.add.overlap(this.player, this.bossZones, (_p, t) => {
      if ((t as Tentacle).damaging) this.damagePlayer();
    });

    // Scene events (the emitter persists across restarts — re-arm cleanly).
    this.events.off(BossEvents.Hp, this.onBossHp, this);
    this.events.on(BossEvents.Hp, this.onBossHp, this);
    this.events.off(BossEvents.Hurt, this.onBossHurt, this);
    this.events.on(BossEvents.Hurt, this.onBossHurt, this);
    this.events.off(BossEvents.Summon, this.onBossSummon, this);
    this.events.on(BossEvents.Summon, this.onBossSummon, this);
    this.events.off(BossEvents.Phase, this.onBossPhase, this);
    this.events.on(BossEvents.Phase, this.onBossPhase, this);
    this.events.off(BossEvents.Defeated, this.onBossDefeated, this);
    this.events.on(BossEvents.Defeated, this.onBossDefeated, this);
  }

  /** Player↔boss contact: stomps bounce (and connect when vulnerable),
   *  ability/item contact strikes any time, side contact hurts. */
  private onPlayerTouchBoss(): void {
    const boss = this.boss;
    if (!boss?.active || boss.isDying || this.failed || this.levelComplete) return;

    // Shadow dash: phases through AND cuts the boss (an ability strike).
    if (this.player.isDashing) {
      if (boss.strike(1)) {
        this.spawnFx(FX_ANIMS.slash, FX_SHEETS.slash.key, boss.x, boss.y - boss.displayHeight / 2, 1.1, {
          flipX: this.player.flipX,
          tintFill: 0x8a5cff,
          additive: true,
          frameRate: 24,
        });
      }
      return;
    }

    // Star power: invincible contact chips the boss down (own slow gate so
    // hugging him for the full star doesn't trivialize the fight).
    if (this.player.isStarPowered) {
      if (this.time.now >= this.starStrikeAt && boss.strike(1)) {
        this.starStrikeAt = this.time.now + 1200;
      }
      return;
    }

    const pb = this.player.body;
    const eb = boss.body;
    const wasAbove = pb.prev.y + pb.height <= eb.top + Physics.STOMP_TOLERANCE_PX;
    if (pb.velocity.y > 0 && wasAbove) {
      this.player.bounce();
      // The bounce leaves the bodies overlapping for a few more frames —
      // that residue must never count as a side hit against the player.
      this.bossContactGraceUntil = this.time.now + 350;
      // A stomp always tries to connect: unrestricted in the vulnerable
      // window (hurt), chip damage through the i-frames otherwise (strike).
      if (!boss.hurt() && !boss.strike(1)) {
        // I-frames still ticking: this one clanks off.
        audioManager.play("clank");
        this.particles.stompPuff(this.player.x, eb.top);
      }
      return;
    }
    if (this.time.now < this.bossContactGraceUntil) return; // just bounced off
    if (boss.canDamage()) this.damagePlayer();
  }

  private onBossHp(frac: number): void {
    ui.setBossHp(frac);
  }

  /** A hit connected: heavy feedback so every HP tick feels earned. */
  private onBossHurt(x: number, y: number): void {
    audioManager.play("bosshurt");
    this.spawnFx(FX_ANIMS.impact, FX_SHEETS.impact.key, x, y, 1.0);
    this.particles.stompPuff(x, y);
    this.cameras.main.shake(110, 0.004);
    gameState.addScore(Progression.STOMP_SCORE * 2);
  }

  /** The Monarch calls a shadow beast (capped so the arena stays fair). */
  private onBossSummon(x: number, y: number): void {
    const alive = this.enemies
      .getChildren()
      .filter((e) => e.active && e instanceof ShadowBeast).length;
    if (alive >= BOSS_MINION_CAP) return;
    const beast = new ShadowBeast(this, x, y, this.level.terrain);
    beast.setDepth(Depth.enemy);
    this.enemies.add(beast);
    this.plodders.add(beast);
    this.particles.shadowKill(x, y - 20); // violet burst as it materializes
  }

  /** Enrage: nudge the soundtrack up — the fight audibly shifts gears. */
  private onBossPhase(): void {
    const bgm = this.bgm as
      | (Phaser.Sound.BaseSound & { setRate?: (rate: number) => unknown })
      | undefined;
    bgm?.setRate?.(1.08);
  }

  /** The boss fell: big send-off, clear the field, then the results flow. */
  private onBossDefeated(x: number, y: number): void {
    if (this.levelComplete || this.failed) return;
    audioManager.play("bossdie");
    this.cameras.main.shake(320, 0.008);
    this.cameras.main.flash(200, 255, 255, 255);
    this.spawnFx(FX_ANIMS.impact, FX_SHEETS.impact.key, x, y, 1.7, { frameRate: 18 });
    this.particles.powerupSparkle(x, y);
    gameState.addScore(BOSS_SCORE);
    ui.setBossHp(0);

    // The minions and projectiles dissolve with their master.
    for (const e of this.enemies.getChildren()) {
      const enemy = e as Enemy;
      if (enemy.active && !enemy.isDying && enemy.stompable) enemy.stomp();
    }
    for (const o of this.bossOrbs.getChildren()) (o as BossOrb).pop();

    this.time.delayedCall(1000, () => this.onBossVictory());
  }

  private onBossVictory(): void {
    if (this.levelComplete || this.failed) return;
    this.levelComplete = true;
    this.bgm?.stop();
    audioManager.play("complete");
    this.finishLevel((done) => this.playBossCelebration(done));
  }

  /** Victory beat in place of the flag slide: pose + a little firework. */
  private playBossCelebration(onDone: () => void): void {
    const p = this.player;
    p.setVelocity(0, 0);
    p.poseLandCelebrate();
    for (let i = 0; i < 5; i++) {
      this.time.delayedCall(i * 170, () =>
        this.particles.powerupSparkle(
          p.x - 60 + Math.random() * 120,
          p.y - 24 - Math.random() * 56
        )
      );
    }
    this.time.delayedCall(COMPLETE_DELAY + 700, onDone);
  }

  /** World y of the first solid ground line under a world x (scanning down
   *  from `fromY`, so callers can skip platforms above a floor line). */
  private groundYAt(x: number, fromY = 16): number {
    const terrain = this.level.terrain;
    for (let y = fromY; y < this.level.heightPx; y += 16) {
      const tile = terrain.getTileAtWorldXY(x, y);
      if (tile && tile.collides) return tile.pixelY;
    }
    return this.level.heightPx;
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
    // Special items go into the Mario-Kart-style slot instead of acting now.
    this.physics.add.overlap(this.player, this.itemPickups, (_p, i) => {
      const item = i as ItemPickup;
      if (!item.collect()) return;
      gameState.heldItem = item.kind;
      this.particles.powerupSparkle(item.x, item.y);
      audioManager.play("powerup");
    });
    // Fireballs: die on solid geometry, kill enemies on contact.
    this.physics.add.collider(this.fireballs, this.level.terrain, (f) =>
      (f as Fireball).explode()
    );
    this.physics.add.collider(this.fireballs, this.blocks, (f) =>
      (f as Fireball).explode()
    );
    this.physics.add.collider(this.fireballs, this.pipes, (f) =>
      (f as Fireball).explode()
    );
    this.physics.add.overlap(this.fireballs, this.enemies, (f, e) => {
      const ball = f as Fireball;
      const enemy = e as Enemy;
      if (ball.isDone || enemy.isDying) return;
      ball.explode();
      this.killEnemy(enemy);
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

  /** Defeat an enemy outright (fireball hit or star-power touch). */
  private killEnemy(enemy: Enemy): void {
    enemy.stomp(); // reuse the squash-and-fade defeat
    gameState.addScore(Progression.STOMP_SCORE);
    this.particles.stompPuff(enemy.x, enemy.body.bottom);
    audioManager.play("stomp");
  }

  /** Fire the stashed item (E/X or the mobile item button). */
  private useHeldItem(): void {
    const item = gameState.heldItem;
    if (!item) return;
    gameState.heldItem = null;

    if (item === "star") {
      this.player.activateStar(STAR_DURATION_MS);
      this.particles.powerupSparkle(this.player.x, this.player.y);
      audioManager.play("powerup");
      return;
    }

    // Fire burst: a quick volley of mini fireballs in the facing direction.
    for (let i = 0; i < FIREBURST_SHOTS; i++) {
      this.time.delayedCall(i * FIREBURST_GAP_MS, () => {
        if (this.failed || this.levelComplete || this.player.isDead) return;
        const dir = this.player.facingDirection;
        // Spawn at torso height so the volley hits ground critters too.
        const ball = new Fireball(
          this,
          this.player.x + dir * 18,
          this.player.y + 4,
          dir
        );
        ball.setDepth(Depth.player);
        this.fireballs.add(ball);
        audioManager.play("doublejump");
      });
    }
  }

  private onPlayerHitEnemy(enemy: Enemy): void {
    if (this.failed || this.levelComplete || !enemy.canDamage()) return;

    // Star power: touching an enemy defeats it, no matter the angle.
    if (this.player.isStarPowered && enemy.stompable) {
      this.killEnemy(enemy);
      return;
    }

    // Shadow dash: enemies in the dash path are cut down in a violet burst;
    // unstompable ones (Snapvine) are simply phased through unharmed.
    if (this.player.isDashing) {
      if (enemy.stompable) {
        enemy.stomp();
        gameState.addScore(Progression.STOMP_SCORE);
        this.particles.shadowKill(enemy.x, enemy.y);
        // The victim is visibly "cut down": a fast violet slash swirl.
        this.spawnFx(FX_ANIMS.slash, FX_SHEETS.slash.key, enemy.x, enemy.y, 0.85, {
          flipX: this.player.flipX,
          tintFill: 0x8a5cff,
          additive: true,
          frameRate: 24,
        });
        audioManager.play("stomp");
      }
      return;
    }

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
    // Ability + water effects (emitted by Player; fx/sfx live in the scene).
    this.events.off("player-dash", this.onPlayerDash, this);
    this.events.on("player-dash", this.onPlayerDash, this);
    this.events.off("player-punch", this.onPlayerPunch, this);
    this.events.on("player-punch", this.onPlayerPunch, this);
    this.events.off("player-dash-trail", this.onPlayerDashTrail, this);
    this.events.on("player-dash-trail", this.onPlayerDashTrail, this);
    this.events.off("player-walljump", this.onPlayerWallJump, this);
    this.events.on("player-walljump", this.onPlayerWallJump, this);
    this.events.off("player-wallslide", this.onPlayerWallSlide, this);
    this.events.on("player-wallslide", this.onPlayerWallSlide, this);
    this.events.off("player-splash", this.onPlayerSplash, this);
    this.events.on("player-splash", this.onPlayerSplash, this);
    this.events.off("player-stroke", this.onPlayerStroke, this);
    this.events.on("player-stroke", this.onPlayerStroke, this);
    this.events.off("player-bubble", this.onPlayerBubble, this);
    this.events.on("player-bubble", this.onPlayerBubble, this);
  }

  /**
   * One-shot effect animation sprite (impact burst/spark/slash); plays once
   * and destroys itself.
   */
  private spawnFx(
    anim: string,
    sheetKey: string,
    x: number,
    y: number,
    scale: number,
    opts: { flipX?: boolean; frameRate?: number; tintFill?: number; additive?: boolean } = {}
  ): void {
    const fx = this.add
      .sprite(x, y, sheetKey, 0)
      .setScale(scale)
      .setFlipX(opts.flipX ?? false)
      .setDepth(Depth.player + 0.5);
    // tintFill recolors the effect into a glowing silhouette (e.g. the red
    // slash swirls turned violet for the shadow theme); additive makes it glow.
    if (opts.tintFill !== undefined) fx.setTintFill(opts.tintFill);
    if (opts.additive) fx.setBlendMode(Phaser.BlendModes.ADD);
    fx.play(opts.frameRate ? { key: anim, frameRate: opts.frameRate } : anim);
    fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
  }

  /**
   * Divergent Fist (Itadori): defeat stompable enemies in a box in front of
   * the fists. A Black Flash blasts a much bigger box (even slightly behind),
   * with red crackle sparks, a camera punch and a red screen tinge.
   */
  private onPlayerPunch(p: Player, dir: 1 | -1, isFlash: boolean): void {
    audioManager.play(isFlash ? "blackflash" : "punch");

    // Impact burst at the fists: blue Divergent-Fist pop, red-spark crackle
    // (on top of the blue burst) for the Black Flash.
    const fistX = p.x + dir * 42;
    this.spawnFx(FX_ANIMS.impact, FX_SHEETS.impact.key, fistX, p.y - 4, isFlash ? 0.9 : 0.55, {
      flipX: dir === -1,
    });
    if (isFlash) {
      // Slowed to 12fps so the red crackle lingers through the whole moment.
      this.spawnFx(FX_ANIMS.spark, FX_SHEETS.spark.key, fistX, p.y + 10, 1.3, {
        flipX: dir === -1,
        frameRate: 12,
      });
      this.cameras.main.shake(140, 0.0045);
      this.cameras.main.flash(110, 90, 8, 8);
    }

    const range = isFlash ? Physics.BLACK_FLASH_RANGE_PX : Physics.PUNCH_RANGE_PX;
    const height = isFlash ? Physics.BLACK_FLASH_HEIGHT_PX : Physics.PUNCH_HEIGHT_PX;
    const back = isFlash ? 50 : 8; // the blast also catches enemies just behind

    for (const obj of this.enemies.getChildren()) {
      const enemy = obj as Enemy;
      if (!enemy.active || !enemy.canDamage() || !enemy.stompable) continue;
      const dx = (enemy.x - p.x) * dir; // >0 = in front, regardless of facing
      if (dx < -back || dx > range) continue;
      if (Math.abs(enemy.y - p.y) > height) continue;
      enemy.stomp();
      gameState.addScore(Progression.STOMP_SCORE);
      this.spawnFx(
        isFlash ? FX_ANIMS.spark : FX_ANIMS.impact,
        isFlash ? FX_SHEETS.spark.key : FX_SHEETS.impact.key,
        enemy.x,
        enemy.y,
        isFlash ? 1.0 : 0.7,
        { flipX: dir === -1 }
      );
      audioManager.play("stomp");
    }

    // The boss too can be punched — an ability strike, so it connects any
    // time. A Black Flash lands DOUBLE damage (it's the every-4th payoff).
    const boss = this.boss;
    if (boss?.active && !boss.isDying) {
      const bb = boss.body;
      const left = dir === 1 ? p.x - back : p.x - range;
      const right = dir === 1 ? p.x + range : p.x + back;
      const inBox =
        bb.right >= left &&
        bb.left <= right &&
        Math.abs(bb.center.y - p.y) <= height + bb.halfHeight;
      if (inBox && !boss.strike(isFlash ? 2 : 1)) audioManager.play("clank");
    }
  }

  /** Shadow dash kickoff: violet burst, whoosh, and a tiny camera nudge —
   *  plus a violet slash swirl ripping open at the launch point (the Itadori
   *  sheet's circular slash, recolored into the shadow theme). */
  private onPlayerDash(x: number, y: number, dir: 1 | -1): void {
    this.particles.dashBurst(x, y);
    this.spawnFx(FX_ANIMS.slash, FX_SHEETS.slash.key, x + dir * 24, y - 2, 1.0, {
      flipX: dir === -1,
      tintFill: 0x9d5cff,
      additive: true,
    });
    audioManager.play("dash");
    this.cameras.main.shake(70, 0.0016);
  }

  /** Violet shades of the shadow-army look (freshest image is brightest,
   *  older ones sink into the deep near-black purple of the reference art). */
  private static readonly SHADOW_SHADES = [0x9d5cff, 0x6a2fd8, 0x4b1f9e, 0x321263];
  private dashTrailTick = 0;

  /**
   * One fading after-image along the dash path — the sprite's current frame
   * as a GLOWING violet silhouette (tintFill: a plain multiplicative tint
   * vanishes on Jin-Woo's near-black sprite). Additive blending over cycling
   * shadow shades gives the Solo-Leveling shadow-soldier look, and each
   * image sheds a couple of rising violet wisps as it dissolves.
   */
  private onPlayerDashTrail(p: Player): void {
    const shade =
      GameScene.SHADOW_SHADES[this.dashTrailTick++ % GameScene.SHADOW_SHADES.length];
    const img = this.add
      .image(p.x, p.y, p.texture.key, p.frame.name)
      .setFlipX(p.flipX)
      .setScale(p.scaleX, p.scaleY)
      .setTintFill(shade)
      .setAlpha(0.85) // NORMAL blend: solid dark silhouettes, not washed-out glow
      .setDepth(Depth.player - 0.1);
    this.tweens.add({
      targets: img,
      alpha: 0,
      y: p.y - 8, // the silhouette drifts up as it burns away
      scaleX: p.scaleX * 1.08,
      scaleY: p.scaleY * 1.08,
      duration: 340,
      ease: "Quad.out",
      onComplete: () => img.destroy(),
    });
    // Soul-fire wisps peeling off the trail.
    this.particles.dashWisps(p.x, p.y);
  }

  private onPlayerWallJump(x: number, y: number): void {
    this.particles.jumpDust(x, y);
  }

  private onPlayerWallSlide(x: number, y: number): void {
    this.particles.wallDust(x, y);
  }

  private onPlayerSplash(x: number, y: number, impact: number): void {
    this.particles.splash(x, y, impact / 500);
    audioManager.play("splash");
  }

  private onPlayerStroke(x: number, y: number): void {
    this.particles.bubbles(x, y + 6, 4);
  }

  private onPlayerBubble(x: number, y: number): void {
    this.particles.bubbles(x, y, 2);
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
    switch (payload.reward) {
      case "growcap": {
        // The cherry works exactly as before: roams, grows on touch.
        const cap = new Growcap(this, payload.x, popY);
        cap.setDepth(Depth.item);
        this.growcaps.add(cap);
        break;
      }
      case "fireburst":
      case "star": {
        const item = new ItemPickup(this, payload.x, popY, payload.reward);
        item.setDepth(Depth.item);
        this.itemPickups.add(item);
        break;
      }
      default:
        // Bonus coin — pays out, but doesn't count toward the star goal.
        this.spawnCoinPop(payload.x, popY);
        this.collectCoin(payload.x, popY, false);
        break;
    }
  }

  /** Award a coin with sparkle + sound, voicing a fanfare on a bonus life. */
  private collectCoin(x: number, y: number, countsTowardGoal = true): void {
    const { extraLife } = gameState.addCoin(countsTowardGoal);
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

  // ----- Ghost replay (race your best run) -----

  /**
   * Classic mode: always record the current attempt (it becomes the ghost on
   * a new best time) and, if enabled and available, play back the stored best
   * run as a translucent ghost.
   */
  private setupGhost(): void {
    // No ghosts on boss stages: the fight is nondeterministic, so a replay
    // of a previous run would just desync into noise.
    if (gameState.isMarathon || getLevel(gameState.levelIndex)?.distance === "boss") {
      this.ghostRecorder = undefined;
      return;
    }
    this.ghostRecorder = new GhostRecorder();
    const data = ghostStore.load(gameState.levelIndex);
    if (data) {
      this.ghost = new GhostPlayer(this, data, Depth.ghost);
      this.ghost.setVisible(ghostStore.isEnabled());
    }
  }

  /** Advance recording + playback with the level clock (called from update). */
  private updateGhost(): void {
    this.ghostRecorder?.update(gameState.timeElapsed, this.player);
    if (this.ghost) {
      this.ghost.setVisible(ghostStore.isEnabled());
      if (ghostStore.isEnabled()) this.ghost.update(gameState.timeElapsed);
    }
  }

  // ----- Run-loop concerns -----

  private damagePlayer(): void {
    const result = this.player.takeDamage();
    // Count real hits (drives the boss stages' "no damage" star).
    if (result !== "invulnerable") gameState.hitsTaken += 1;
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
    this.bgm?.stop();
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
    this.bgm?.stop();
    audioManager.play("complete");
    this.finishLevel((done) => this.playFlagSequence(done));
  }

  /**
   * Shared level-completion flow: stars, records, then the results screen —
   * preceded by the stage's outro `sequence` (flag slide on regular levels,
   * the victory beat on boss stages).
   */
  private finishLevel(sequence: (onDone: () => void) => void): void {
    const levelIndex = gameState.levelIndex;
    const level = getLevel(levelIndex)!;
    const timeSec = gameState.timeElapsed;
    // The marathon only runs the short-distance stages (0..3); the medium
    // levels end a classic run at the true last manifest entry.
    const lastLevel = gameState.isMarathon
      ? levelIndex >= MARATHON_LEVEL_COUNT - 1
      : levelIndex >= LEVEL_COUNT - 1;

    // Stars: 1 for the clear, +1 for every coin, +1 for beating the par time.
    // Boss arenas have no coins — their middle star is "take no damage".
    const bossStage = level.distance === "boss";
    const noDamage = gameState.hitsTaken === 0;
    const allCoins = gameState.allLevelCoins;
    const underPar = timeSec <= level.parTime;
    const stars =
      1 + ((bossStage ? noDamage : allCoins) ? 1 : 0) + (underPar ? 1 : 0);

    const bonus = gameState.awardTimeBonus(level.parTime);
    // Per-level records also count in a marathon: the level timer resets on
    // every (re)start, so timeElapsed is a fair single-level clear time.
    // All records go out as ONE batched persist (a single backend POST).
    let newBestTime = false;
    let newBestRun = false;
    saveState.batch(() => {
      newBestTime = saveState.recordBestTime(levelIndex, timeSec);
      saveState.unlockLevel(Math.min(levelIndex + 1, LEVEL_COUNT - 1));
      saveState.recordLevelStars(levelIndex, stars);
      saveState.recordBestCoins(levelIndex, gameState.levelCoins);
      saveState.recordScore(gameState.score);
      if (gameState.isMarathon && lastLevel) {
        newBestRun = saveState.recordMarathon(
          gameState.runTime,
          gameState.runCoins,
          gameState.deaths
        );
      }
    });

    // A new best time crowns this run as the level's ghost. Also seed a ghost
    // when none exists yet — old profiles carry best times from before the
    // ghost feature that may never be beaten, and without this the toggle
    // would stay dead forever.
    if (this.ghostRecorder && (newBestTime || !ghostStore.load(levelIndex))) {
      ghostStore.save(levelIndex, this.ghostRecorder.finish(timeSec, this.player));
    }

    // Marathon: no results screen between levels — flag sequence, a world-title
    // splash, then straight into the next level. Only the final level shows
    // the run summary.
    if (gameState.isMarathon && !lastLevel) {
      sequence(() => {
        gameState.advanceLevel();
        ui.showMarathonSplash(gameState.levelIndex);
        fadeOutThen(this, () => this.scene.restart());
      });
      return;
    }

    if (gameState.isMarathon) {
      const runTime = gameState.runTime;
      const runCoins = gameState.runCoins;
      const deaths = gameState.deaths;
      sequence(() => {
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

    sequence(() => {
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
          bossStage,
          noDamage,
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
    return !this.failed && !this.levelComplete && !this.warping;
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
      inWater: () => this.player.isInWater,
      isDashing: () => this.player.isDashing,
      isWallSliding: () => this.player.isWallSliding,
      specialCooldown: () => this.player.specialCooldownFrac,
      waterZoneCount: () => this.waterZones.length,
      hasGhost: () => this.ghost !== undefined,
      // Boss-stage inspection
      hasBoss: () => this.boss?.active === true,
      bossHp: () => this.boss?.hpFrac ?? null,
      bossVulnerable: () => this.boss?.isVulnerable ?? false,
      bossEnraged: () => this.boss?.isEnraged ?? false,
      bossPos: () =>
        this.boss ? { x: this.boss.x, y: this.boss.y } : null,
      bossOrbCount: () => this.bossOrbs.getLength(),
      tentacleCount: () => this.bossZones.getLength(),
      tentacleRoots: () =>
        this.bossZones
          .getChildren()
          .map((t) => ({ x: (t as Tentacle).x, y: (t as Tentacle).y })),
      hitsTaken: () => gameState.hitsTaken,
      hurtBoss: () => this.boss?.hurt() ?? false,
      strikeBoss: (amount = 1) => this.boss?.strike(amount) ?? false,
      activateStar: (ms = 600000) => this.player.activateStar(ms),
      itemBlocks: () =>
        this.blocks
          .getChildren()
          .filter((b): b is ItemBlock => b instanceof ItemBlock)
          .map((b) => ({ x: b.x, y: b.y, spent: b.isSpent })),
      hitItemBlock: () => {
        const b = this.blocks
          .getChildren()
          .find((c): c is ItemBlock => c instanceof ItemBlock);
        b?.hitFromBelow(this.player);
      },
      forceVulnerable: () => {
        const b = this.boss as unknown as { vulnerableFlag?: boolean } | undefined;
        if (b) b.vulnerableFlag = true;
      },
      pressSpecial: () => {
        if (window.touchInputState) window.touchInputState.special = true;
        this.time.delayedCall(50, () => {
          if (window.touchInputState) window.touchInputState.special = false;
        });
      },
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
