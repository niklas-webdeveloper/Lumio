import Phaser from "phaser";
import { Fonts } from "@/config/GameConfig";

export interface IconButtonOptions {
  /** On-screen size (design px) of the square button. */
  size?: number;
  /** Optional label shown beneath the button (uses the title font). */
  label?: string;
  labelSize?: number;
  onClick: () => void;
}

/**
 * A button built from a UI sprite, with smooth hover/press feedback and an
 * optional label. Returns a Container (button image [+ label]) that is
 * pointer-interactive; scenes can also trigger `onClick` from the keyboard.
 */
export function createIconButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  texture: string,
  opts: IconButtonOptions
): Phaser.GameObjects.Container {
  const size = opts.size ?? 64;
  const container = scene.add.container(x, y);

  const img = scene.add.image(0, 0, texture).setDisplaySize(size, size);
  container.add(img);

  if (opts.label) {
    const label = scene.add
      .text(0, size / 2 + 10, opts.label, {
        fontFamily: Fonts.title,
        fontSize: `${opts.labelSize ?? 20}px`,
        color: "#ffffff",
      })
      .setOrigin(0.5, 0)
      .setShadow(0, 2, "#0006", 3);
    container.add(label);
  }

  container.setSize(size, size);
  container.setInteractive(
    new Phaser.Geom.Rectangle(-size / 2, -size / 2, size, size),
    Phaser.Geom.Rectangle.Contains
  );

  const tweenTo = (scale: number, duration = 90) =>
    scene.tweens.add({ targets: container, scale, duration, ease: "Quad.out" });

  container.on("pointerover", () => {
    tweenTo(1.09);
    img.setTint(0xffffff);
  });
  container.on("pointerout", () => {
    tweenTo(1);
    img.clearTint();
  });
  container.on("pointerdown", () => tweenTo(0.93, 60));
  container.on("pointerup", () => {
    tweenTo(1.09, 80);
    opts.onClick();
  });

  return container;
}
