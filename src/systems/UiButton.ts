import Phaser from "phaser";

export interface ButtonOptions {
  width: number;
  height: number;
  label: string;
  fontSize?: number;
  /** Base fill color. */
  color?: number;
  /** Fill on hover. */
  hoverColor?: number;
  textColor?: string;
  onClick: () => void;
}

/**
 * A rounded, glossy button as a Container (rounded-rect graphics + label) with
 * hover/press feedback and a click handler. Works with mouse and touch; scenes
 * can also drive `onClick` from the keyboard.
 */
export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: ButtonOptions
): Phaser.GameObjects.Container {
  const w = opts.width;
  const h = opts.height;
  const radius = Math.min(16, h / 2);
  const color = opts.color ?? 0x36c25b;
  const hoverColor = opts.hoverColor ?? 0x49db70;

  const container = scene.add.container(x, y);
  const g = scene.add.graphics();

  const redraw = (fill: number) => {
    g.clear();
    g.fillStyle(0x000000, 0.28); // drop shadow
    g.fillRoundedRect(-w / 2 + 3, -h / 2 + 5, w, h, radius);
    g.fillStyle(fill, 1); // body
    g.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
    g.fillStyle(0xffffff, 0.22); // top gloss
    g.fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h / 2 - 4, radius - 4);
    g.lineStyle(3, 0xffffff, 0.85); // crisp border
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
  };
  redraw(color);

  const label = scene.add
    .text(0, 0, opts.label, {
      fontFamily: "'Nunito', sans-serif",
      fontSize: `${opts.fontSize ?? 22}px`,
      color: opts.textColor ?? "#ffffff",
      fontStyle: "bold",
    })
    .setOrigin(0.5);

  container.add([g, label]);
  container.setSize(w, h);
  container.setInteractive(
    new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
    Phaser.Geom.Rectangle.Contains
  );

  container.on("pointerover", () => {
    redraw(hoverColor);
    container.setScale(1.06);
  });
  container.on("pointerout", () => {
    redraw(color);
    container.setScale(1);
  });
  container.on("pointerdown", () => container.setScale(0.97));
  container.on("pointerup", () => {
    container.setScale(1.06);
    opts.onClick();
  });

  return container;
}
