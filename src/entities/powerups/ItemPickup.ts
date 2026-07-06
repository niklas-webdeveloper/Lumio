import Phaser from "phaser";
import { TextureKeys } from "@/config/AssetKeys";
import { WorldAnim } from "@/config/worldArt";
import { TILE_SIZE } from "@/config/GameConfig";

/** The two Mario-Kart-style stashable items a "?" block can drop. */
export type SpecialItemKind = "fireburst" | "star";

/**
 * A stashable special item (fire-burst ember or star gem). Rises out of its
 * block like the Growcap, then hovers in place with a gentle bob until the
 * player touches it — which stores it in the HUD item slot for later use.
 */
export class ItemPickup extends Phaser.Physics.Arcade.Sprite {
  public declare body: Phaser.Physics.Arcade.Body;
  private consumed = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    public readonly kind: SpecialItemKind
  ) {
    super(scene, x, y, kind === "star" ? TextureKeys.Gem : TextureKeys.ItemFire);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(0.5, 1);
    this.setScale(kind === "star" ? 2 : 1.4); // gem art is 15x13 world-16px art
    if (kind === "star" && scene.anims.exists(WorldAnim.gemSpin)) {
      this.play(WorldAnim.gemSpin);
    }
    this.body.setAllowGravity(false);
    this.body.enable = false; // pickup off until it finishes emerging

    // Rise one tile out of the block, then hover with a soft bob.
    scene.tweens.add({
      targets: this,
      y: y - TILE_SIZE,
      duration: 300,
      ease: "Quad.out",
      onComplete: () => {
        this.body.enable = true;
        scene.tweens.add({
          targets: this,
          y: this.y - 5,
          duration: 700,
          yoyo: true,
          repeat: -1,
          ease: "Sine.inOut",
        });
      },
    });
  }

  /** Consume the pickup (stored in the item slot); plays a little pop-out. */
  collect(): boolean {
    if (this.consumed) return false;
    this.consumed = true;
    this.body.enable = false;
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      y: this.y - 14,
      alpha: 0,
      scale: this.scale * 1.3,
      duration: 220,
      ease: "Quad.out",
      onComplete: () => this.destroy(),
    });
    return true;
  }
}
