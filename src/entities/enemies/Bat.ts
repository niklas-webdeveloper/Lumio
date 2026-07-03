import Phaser from "phaser";
import { TextureKeys } from "@/config/AssetKeys";
import { WorldAnim } from "@/config/worldArt";
import type { Player } from "@/entities/Player";
import { Enemy } from "./Enemy";

/** How close the player must get (px) before the bat wakes. */
const WAKE_RADIUS = 150;
/** Brief shudder before the bat drops off its perch (ms). */
const WAKE_DELAY_MS = 350;
/** Chase speed (px/s) — slow enough to outrun, persistent enough to matter. */
const CHASE_SPEED = 74;
/** Amplitude (px/s) and frequency (rad/s) of the flappy vertical wobble. */
const WOBBLE_SPEED = 55;
const WOBBLE_FREQ = 7;

/** Display scale of the SunnyLand bat art in the 32px world. */
const BAT_SCALE = 1.1;
/** Chase-flight physics body in source px (inside the wings), centered. */
const FLY_BODY_W = 30;
const FLY_BODY_H = 22;

type BatState = "hanging" | "waking" | "chasing";

/**
 * Bat: the graveyard ambusher. Hangs dormant (and harmless) from the underside
 * of a platform; when the player wanders close it shudders awake, drops, and
 * then relentlessly drifts toward the player — through terrain, ghost-style.
 * It's slower than the player, so you can run… but it will still be there on
 * the way back. A stomp puts it down for good.
 *
 * Spawn position is the ceiling anchor point (underside of the perch).
 */
export class Bat extends Enemy {
  public readonly stompable = true;

  private mode: BatState = "hanging";
  private wakeTimer = WAKE_DELAY_MS;
  private phase = Math.random() * Math.PI * 2;

  constructor(
    scene: Phaser.Scene,
    ceilingX: number,
    ceilingY: number,
    private readonly player: Player
  ) {
    super(scene, ceilingX, ceilingY, TextureKeys.BatHang);
    this.setScale(BAT_SCALE);
    this.body.setAllowGravity(false);
    this.setCollideWorldBounds(false);
    // Feet-anchored origin: hang so the sprite's top touches the ceiling.
    this.setY(ceilingY + this.displayHeight);
    this.body.enable = false; // dormant: no contact damage, no stomp
    this.play(WorldAnim.batHang);
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (this.dying) return;

    switch (this.mode) {
      case "hanging": {
        const dist = Phaser.Math.Distance.Between(
          this.x,
          this.y - this.displayHeight / 2,
          this.player.x,
          this.player.y
        );
        if (dist <= WAKE_RADIUS) {
          this.mode = "waking";
          this.wakeTimer = WAKE_DELAY_MS;
          // A tell before the drop: a quick shudder on the perch.
          this.scene.tweens.add({
            targets: this,
            x: this.x + 2,
            duration: 45,
            yoyo: true,
            repeat: 3,
          });
        }
        break;
      }

      case "waking":
        if ((this.wakeTimer -= delta) <= 0) this.takeWing();
        break;

      case "chasing": {
        if (this.player.isDead) {
          this.setVelocity(0, 0);
          break;
        }
        const angle = Math.atan2(this.player.y - this.y, this.player.x - this.x);
        this.phase += (delta / 1000) * WOBBLE_FREQ;
        this.setVelocity(
          Math.cos(angle) * CHASE_SPEED,
          Math.sin(angle) * CHASE_SPEED + Math.sin(this.phase) * WOBBLE_SPEED
        );
        this.setFlipX(this.player.x > this.x); // art faces left by default
        break;
      }
    }
  }

  /** Switch from the hanging pose to the chase flight (art + body + physics). */
  private takeWing(): void {
    this.mode = "chasing";
    this.setTexture(TextureKeys.BatFly, 0);
    this.play(WorldAnim.batFly);
    this.body.setSize(FLY_BODY_W, FLY_BODY_H);
    this.body.setOffset(
      (this.width - FLY_BODY_W) / 2,
      (this.height - FLY_BODY_H) / 2
    );
    this.body.enable = true;
  }
}
