import Phaser from "phaser";
import { TextureKeys, PlayerArt } from "@/config/AssetKeys";
import { TILE_COUNT } from "@/config/Tiles";
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from "@/config/GameConfig";

/**
 * Procedural pixel-art generator.
 *
 * Every visual in the game is drawn here at runtime — original art, no external
 * files or licenses. To swap in hand-made art later, load an image under the
 * same key in PreloadScene *instead* of calling the matching generator; all
 * game code references textures by key, so nothing else changes.
 *
 * Tiles are drawn into a single horizontal strip so the result can be used as a
 * Phaser tilemap tileset (GID order matches src/config/Tiles.ts).
 */

/** Fill an axis-aligned block of "pixels" (helper to keep drawing readable). */
function px(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
  alpha = 1
): void {
  g.fillStyle(color, alpha);
  g.fillRect(x, y, w, h);
}

/** Pseudo-random scatter of small specks for surface texture (deterministic). */
function scatter(
  g: Phaser.GameObjects.Graphics,
  ox: number,
  oy: number,
  size: number,
  count: number,
  color: number,
  seed: number
): void {
  let s = seed;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let i = 0; i < count; i++) {
    const x = ox + Math.floor(rnd() * (size - 2));
    const y = oy + Math.floor(rnd() * (size - 2));
    px(g, x, y, 2, 2, color);
  }
}

// ----- Individual tile painters (each draws one 32px cell at offset ox) -----

function paintGrassTop(g: Phaser.GameObjects.Graphics, ox: number): void {
  px(g, ox, 0, TILE_SIZE, TILE_SIZE, 0x7a4b28); // dirt base
  scatter(g, ox, 12, TILE_SIZE, 10, 0x5c3a20, 7);
  px(g, ox, 0, TILE_SIZE, 11, 0x6abe30); // grass band
  px(g, ox, 0, TILE_SIZE, 2, 0x9be35a); // bright top highlight
  px(g, ox, 10, TILE_SIZE, 1, 0x4b8b28); // grass/dirt seam
  // a few darker grass blades for texture
  px(g, ox + 5, 2, 2, 6, 0x4b8b28);
  px(g, ox + 16, 3, 2, 5, 0x4b8b28);
  px(g, ox + 26, 2, 2, 6, 0x4b8b28);
}

function paintDirt(g: Phaser.GameObjects.Graphics, ox: number): void {
  px(g, ox, 0, TILE_SIZE, TILE_SIZE, 0x7a4b28);
  scatter(g, ox, 0, TILE_SIZE, 14, 0x5c3a20, 13);
  scatter(g, ox, 0, TILE_SIZE, 6, 0x9a6438, 29);
}

function paintStone(g: Phaser.GameObjects.Graphics, ox: number): void {
  px(g, ox, 0, TILE_SIZE, TILE_SIZE, 0x9098a8);
  px(g, ox, 0, TILE_SIZE, 3, 0xb7bdc9); // top highlight
  px(g, ox, TILE_SIZE - 3, TILE_SIZE, 3, 0x5f6678); // bottom shadow
  px(g, ox, 0, 2, TILE_SIZE, 0xa6adba); // left highlight
  // a subtle crack
  px(g, ox + 18, 8, 2, 10, 0x5f6678);
  px(g, ox + 16, 14, 2, 6, 0x5f6678);
}

function paintBrick(g: Phaser.GameObjects.Graphics, ox: number): void {
  px(g, ox, 0, TILE_SIZE, TILE_SIZE, 0xb5532e);
  const mortar = 0xe0a878;
  // horizontal mortar lines
  px(g, ox, 0, TILE_SIZE, 2, mortar);
  px(g, ox, 15, TILE_SIZE, 2, mortar);
  px(g, ox, 30, TILE_SIZE, 2, mortar);
  // staggered vertical mortar
  px(g, ox + 15, 2, 2, 13, mortar); // upper row split
  px(g, ox, 17, 2, 13, mortar); // lower row split (left)
  px(g, ox + 30, 17, 2, 13, mortar); // lower row split (right)
  // top inner highlight on bricks
  px(g, ox + 2, 2, TILE_SIZE - 4, 1, 0xc9683f);
}

function paintLucky(g: Phaser.GameObjects.Graphics, ox: number): void {
  px(g, ox, 0, TILE_SIZE, TILE_SIZE, 0xf2c14e);
  px(g, ox, 0, TILE_SIZE, 2, 0xffe08a); // top sheen
  px(g, ox, 0, 2, TILE_SIZE, 0xffe08a);
  px(g, ox + 1, TILE_SIZE - 2, TILE_SIZE - 1, 2, 0xc8941f); // bottom edge
  px(g, ox + TILE_SIZE - 2, 1, 2, TILE_SIZE - 1, 0xc8941f);
  // corner rivets
  const rivet = 0x8a5e12;
  px(g, ox + 3, 3, 2, 2, rivet);
  px(g, ox + 27, 3, 2, 2, rivet);
  px(g, ox + 3, 27, 2, 2, rivet);
  px(g, ox + 27, 27, 2, 2, rivet);
  // blocky "?" glyph
  const ink = 0x7a4a08;
  px(g, ox + 11, 8, 9, 3, ink); // top bar
  px(g, ox + 18, 10, 3, 5, ink); // upper-right
  px(g, ox + 12, 14, 7, 3, ink); // middle
  px(g, ox + 14, 16, 3, 5, ink); // stem
  px(g, ox + 14, 24, 3, 3, ink); // dot
}

function paintUsed(g: Phaser.GameObjects.Graphics, ox: number): void {
  px(g, ox, 0, TILE_SIZE, TILE_SIZE, 0x9a7b4f);
  px(g, ox, 0, TILE_SIZE, 2, 0xb59a6e);
  px(g, ox, TILE_SIZE - 2, TILE_SIZE, 2, 0x6e5638);
  const rivet = 0x5b452c;
  px(g, ox + 3, 3, 2, 2, rivet);
  px(g, ox + 27, 3, 2, 2, rivet);
  px(g, ox + 3, 27, 2, 2, rivet);
  px(g, ox + 27, 27, 2, 2, rivet);
}

function paintSpike(g: Phaser.GameObjects.Graphics, ox: number): void {
  // Transparent background — spikes overlay whatever is beneath them.
  const base = 0x7a8290;
  const metal = 0xc0c8d4;
  px(g, ox, 27, TILE_SIZE, 5, base); // mounting base
  // four upward triangles
  for (let i = 0; i < 4; i++) {
    const bx = ox + i * 8;
    g.fillStyle(metal, 1);
    g.fillTriangle(bx, 27, bx + 4, 6, bx + 8, 27);
    g.fillStyle(0xffffff, 0.5);
    g.fillTriangle(bx + 3, 12, bx + 4, 6, bx + 5, 12); // glint
  }
}

function paintPlate(g: Phaser.GameObjects.Graphics, ox: number): void {
  px(g, ox, 0, TILE_SIZE, TILE_SIZE, 0x6f7d96);
  px(g, ox, 0, TILE_SIZE, 3, 0x97a6bf);
  px(g, ox, TILE_SIZE - 4, TILE_SIZE, 4, 0x4a566b);
  const bolt = 0x39435a;
  px(g, ox + 4, 5, 3, 3, bolt);
  px(g, ox + 25, 5, 3, 3, bolt);
  px(g, ox + 4, 24, 3, 3, bolt);
  px(g, ox + 25, 24, 3, 3, bolt);
}

/** Build the terrain tileset texture (one 32px tile per GID, left to right). */
function createTileset(scene: Phaser.Scene): void {
  if (scene.textures.exists(TextureKeys.Tiles)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Painters in GID order (GID 1 -> column 0, etc.).
  const painters = [
    paintGrassTop,
    paintDirt,
    paintStone,
    paintBrick,
    paintLucky,
    paintUsed,
    paintSpike,
    paintPlate,
  ];
  painters.forEach((paint, i) => paint(g, i * TILE_SIZE));

  g.generateTexture(TextureKeys.Tiles, TILE_COUNT * TILE_SIZE, TILE_SIZE);
  g.destroy();
}

/** Vertical gradient sky filling the whole viewport (static parallax base). */
function createSky(scene: Phaser.Scene): void {
  if (scene.textures.exists(TextureKeys.Sky)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const top = Phaser.Display.Color.ValueToColor(0x4a86d6);
  const bottom = Phaser.Display.Color.ValueToColor(0xcdeffc);
  for (let y = 0; y < GAME_HEIGHT; y++) {
    const t = y / (GAME_HEIGHT - 1);
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(
      top,
      bottom,
      100,
      Math.floor(t * 100)
    );
    px(g, 0, y, GAME_WIDTH, 1, Phaser.Display.Color.GetColor(c.r, c.g, c.b));
  }
  g.generateTexture(TextureKeys.Sky, GAME_WIDTH, GAME_HEIGHT);
  g.destroy();
}

/** Draw a seamless rolling-hills silhouette (matching edges so it tiles). */
function createHills(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  baseY: number,
  amp: number,
  periods: number,
  color: number,
  topEdge: number
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const pts: Phaser.Types.Math.Vector2Like[] = [];
  for (let x = 0; x <= width; x += 4) {
    const y =
      baseY - amp * (0.5 + 0.5 * Math.sin((2 * Math.PI * periods * x) / width));
    pts.push({ x, y });
  }
  pts.push({ x: width, y: height });
  pts.push({ x: 0, y: height });
  g.fillStyle(color, 1);
  g.fillPoints(pts, true);
  // lighter rim along the crest for a touch of depth
  g.lineStyle(2, topEdge, 1);
  g.beginPath();
  for (let x = 0; x <= width; x += 4) {
    const y =
      baseY - amp * (0.5 + 0.5 * Math.sin((2 * Math.PI * periods * x) / width));
    if (x === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.strokePath();
  g.generateTexture(key, width, height);
  g.destroy();
}

/** A spinning gold coin (animated in-engine via a scaleX flip tween). */
function createCoin(scene: Phaser.Scene): void {
  if (scene.textures.exists(TextureKeys.Coin)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const r = 10;
  g.fillStyle(0xc8941f, 1); // outer rim
  g.fillCircle(r, r, r);
  g.fillStyle(0xf2c14e, 1); // face
  g.fillCircle(r, r, r - 2);
  g.fillStyle(0xffe08a, 1); // inner sheen
  g.fillCircle(r, r, r - 5);
  g.fillStyle(0xc8941f, 1); // engraved center bar
  g.fillRect(r - 1, 4, 2, 12);
  g.fillStyle(0xffffff, 0.8); // glint
  g.fillCircle(r - 3, r - 3, 1.5);
  g.generateTexture(TextureKeys.Coin, r * 2, r * 2);
  g.destroy();
}

/** The Growcap power-up: a friendly capped sprite (original, mushroom-ish). */
function createGrowcap(scene: Phaser.Scene): void {
  if (scene.textures.exists(TextureKeys.Growcap)) return;
  const w = 26;
  const h = 24;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // stem / body
  px(g, 6, 12, 14, 11, 0xf6e7c5);
  px(g, 6, 12, 14, 2, 0xfff6e0); // top sheen of stem
  // face
  px(g, 9, 16, 2, 3, 0x3a2a18); // left eye
  px(g, 15, 16, 2, 3, 0x3a2a18); // right eye
  // cap (red dome)
  g.fillStyle(0xe23b4e, 1);
  g.fillEllipse(w / 2, 12, w, 20);
  g.fillStyle(0xff5d73, 1); // cap highlight band
  g.fillEllipse(w / 2, 9, w - 4, 12);
  // cream spots
  g.fillStyle(0xfff1d6, 1);
  g.fillCircle(8, 9, 3);
  g.fillCircle(18, 8, 2.5);
  g.fillCircle(13, 5, 2);
  g.generateTexture(TextureKeys.Growcap, w, h);
  g.destroy();
}

/** Plodder: a small, grumpy walking critter. */
function createPlodder(scene: Phaser.Scene): void {
  if (scene.textures.exists(TextureKeys.Plodder)) return;
  const w = 28;
  const h = 24;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // feet
  px(g, 4, 20, 7, 4, 0x5a3617);
  px(g, 17, 20, 7, 4, 0x5a3617);
  // body
  g.fillStyle(0xa9692f, 1);
  g.fillEllipse(w / 2, 12, 26, 22);
  g.fillStyle(0xc4854a, 1); // lighter top
  g.fillEllipse(w / 2, 9, 22, 12);
  // eyes
  px(g, 8, 9, 5, 6, 0xffffff);
  px(g, 16, 9, 5, 6, 0xffffff);
  px(g, 10, 11, 2, 3, 0x21130a); // pupils
  px(g, 18, 11, 2, 3, 0x21130a);
  // angry brows
  px(g, 7, 7, 6, 2, 0x3a2210);
  px(g, 16, 7, 6, 2, 0x3a2210);
  g.generateTexture(TextureKeys.Plodder, w, h);
  g.destroy();
}

/** Snapvine: a biting plant head on a short stem (origin centered). */
function createSnapvine(scene: Phaser.Scene): void {
  if (scene.textures.exists(TextureKeys.Snapvine)) return;
  const w = 26;
  const h = 40;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // stem
  px(g, 11, 22, 4, 18, 0x3aa34a);
  px(g, 11, 22, 2, 18, 0x53c163); // stem highlight
  // leaves
  g.fillStyle(0x2f8a3d, 1);
  g.fillTriangle(7, 26, 13, 22, 13, 30);
  g.fillTriangle(19, 26, 13, 22, 13, 30);
  // head bulb
  g.fillStyle(0xe23b4e, 1);
  g.fillEllipse(w / 2, 14, 24, 26);
  g.fillStyle(0xff6178, 1); // highlight
  g.fillEllipse(w / 2 - 2, 10, 12, 12);
  // mouth
  g.fillStyle(0x5c0f1c, 1);
  g.fillEllipse(w / 2, 16, 14, 10);
  // teeth (white triangles top & bottom)
  g.fillStyle(0xffffff, 1);
  for (let i = 0; i < 3; i++) {
    const tx = 7 + i * 6;
    g.fillTriangle(tx, 12, tx + 3, 16, tx + 6, 12); // upper
    g.fillTriangle(tx, 20, tx + 3, 16, tx + 6, 20); // lower
  }
  g.generateTexture(TextureKeys.Snapvine, w, h);
  g.destroy();
}

/** Pipe: a green obstacle with a hollow mouth the Snapvine emerges from. */
function createPipe(scene: Phaser.Scene): void {
  if (scene.textures.exists(TextureKeys.Pipe)) return;
  const w = 64;
  const h = 80;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // shaft (inset under the rim)
  px(g, 4, 14, w - 8, h - 14, 0x3aa34a);
  px(g, 6, 14, 8, h - 14, 0x6cd07a); // left highlight
  px(g, w - 14, 14, 8, h - 14, 0x2a7d37); // right shadow
  // rim (full width, slightly taller band)
  px(g, 0, 0, w, 16, 0x2f8a3d);
  px(g, 0, 0, w, 3, 0x6cd07a); // rim top sheen
  px(g, 0, 13, w, 3, 0x215f29); // rim base shadow
  // hollow mouth
  px(g, 10, 3, w - 20, 11, 0x123a18);
  g.generateTexture(TextureKeys.Pipe, w, h);
  g.destroy();
}

/** Standalone 32px textures for interactive blocks (sprites, not tiles). */
function createEntityBlocks(scene: Phaser.Scene): void {
  const gen = (
    key: string,
    paint: (g: Phaser.GameObjects.Graphics, ox: number) => void
  ) => {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    paint(g, 0);
    g.generateTexture(key, TILE_SIZE, TILE_SIZE);
    g.destroy();
  };
  gen(TextureKeys.LuckyBlock, paintLucky);
  gen(TextureKeys.Brick, paintBrick);
  gen(TextureKeys.UsedBlock, paintUsed);
}

/** Goal beacon: a pole with a pennant and a glowing top, drawn once. */
function createBeacon(scene: Phaser.Scene): void {
  if (scene.textures.exists(TextureKeys.Beacon)) return;
  const w = 40;
  const h = 200;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // pole
  px(g, 16, 8, 5, h - 8, 0xc7cdd8);
  px(g, 16, 8, 2, h - 8, 0xeef1f6); // highlight
  // base
  px(g, 8, h - 10, 22, 10, 0x6f7d96);
  // glowing orb on top
  g.fillStyle(0x9be35a, 1);
  g.fillCircle(18, 8, 7);
  g.fillStyle(0xffffff, 0.7);
  g.fillCircle(16, 6, 2);
  // pennant
  g.fillStyle(0xff5d73, 1);
  g.fillTriangle(21, 16, 39, 26, 21, 36);
  g.fillStyle(0xffffff, 0.25);
  g.fillTriangle(21, 16, 30, 21, 21, 26);
  g.generateTexture(TextureKeys.Beacon, w, h);
  g.destroy();
}

type LumioPose = "idle" | "run0" | "run1" | "run2" | "run3" | "jump";
type Pt = [number, number];

/** Per-pose limb keyframes, authored in a base 24×32 grid (cx = 12). */
interface PoseFrame {
  nKnee: Pt;
  nFoot: Pt;
  fKnee: Pt;
  fFoot: Pt;
  nHand: Pt;
  fHand: Pt;
}

const POSES: Record<LumioPose, PoseFrame> = {
  // standing
  idle: { nKnee: [15, 26], nFoot: [15, 31], fKnee: [9, 26], fFoot: [9, 31], nHand: [18, 20], fHand: [6, 20] },
  // 4-frame run cycle (near = right leg/arm; legs & arms swing in opposition)
  run0: { nKnee: [16, 25], nFoot: [18, 30], fKnee: [8, 25], fFoot: [6, 31], nHand: [13, 19], fHand: [16, 18] },
  run1: { nKnee: [15, 25], nFoot: [14, 31], fKnee: [11, 24], fFoot: [11, 28], nHand: [16, 20], fHand: [11, 19] },
  run2: { nKnee: [10, 25], nFoot: [7, 31], fKnee: [14, 25], fFoot: [17, 31], nHand: [18, 19], fHand: [10, 18] },
  run3: { nKnee: [12, 24], nFoot: [12, 28], fKnee: [10, 26], fFoot: [10, 31], nHand: [13, 20], fHand: [14, 19] },
  // airborne: legs tucked, arms up
  jump: { nKnee: [16, 24], nFoot: [17, 27], fKnee: [8, 24], fFoot: [7, 27], nHand: [19, 9], fHand: [6, 10] },
};

/**
 * Draw one frame of Lumio — a small cyan creature with a head/body, two arms and
 * two jointed legs that visibly stride. Authored in a 24×32 grid and scaled to
 * the requested size, so small and big share one definition. Faces right by
 * default (flipX handles left).
 */
function drawLumio(
  g: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  pose: LumioPose
): void {
  const sx = w / 24;
  const sy = h / 32;
  const sAvg = (sx + sy) / 2;

  const COL = {
    body: 0x5fc7f0,
    outline: 0x2f93c4,
    belly: 0xd9f3ff,
    limb: 0x4ab3e0,
    limbFar: 0x3884ad,
    foot: 0x2f7fa8,
    footFar: 0x276a8e,
  };

  // A thick, round-capped segment between two base-grid points (a limb bone).
  const seg = (p1: Pt, p2: Pt, thick: number, color: number) => {
    const ax = p1[0] * sx;
    const ay = p1[1] * sy;
    const bx = p2[0] * sx;
    const by = p2[1] * sy;
    const th = thick * sAvg;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * (th / 2);
    const ny = (dx / len) * (th / 2);
    g.fillStyle(color, 1);
    g.fillTriangle(ax + nx, ay + ny, ax - nx, ay - ny, bx - nx, by - ny);
    g.fillTriangle(ax + nx, ay + ny, bx - nx, by - ny, bx + nx, by + ny);
    g.fillCircle(ax, ay, th / 2);
    g.fillCircle(bx, by, th / 2);
  };
  const drawLeg = (hip: Pt, knee: Pt, foot: Pt, col: number, fcol: number) => {
    seg(hip, knee, 4.6, col);
    seg(knee, foot, 4.0, col);
    g.fillStyle(fcol, 1);
    g.fillEllipse(foot[0] * sx, foot[1] * sy, 6.5 * sx, 3.6 * sy);
  };
  const drawArm = (sh: Pt, hand: Pt, col: number) => {
    seg(sh, hand, 3.2, col);
    g.fillStyle(col, 1);
    g.fillCircle(hand[0] * sx, hand[1] * sy, 1.9 * sAvg);
  };
  const rrect = (bx: number, by: number, bw: number, bh: number, r: number, c: number) => {
    g.fillStyle(c, 1);
    g.fillRoundedRect(bx * sx, by * sy, bw * sx, bh * sy, r * sAvg);
  };
  const circle = (cx: number, cy: number, r: number, c: number) => {
    g.fillStyle(c, 1);
    g.fillCircle(cx * sx, cy * sy, r * sAvg);
  };

  const p = POSES[pose];
  const nearHip: Pt = [14.5, 20];
  const farHip: Pt = [9.5, 20];
  const nearSh: Pt = [16.5, 13];
  const farSh: Pt = [7.5, 13];

  // Back (far) limbs first so they sit behind the body.
  drawArm(farSh, p.fHand, COL.limbFar);
  drawLeg(farHip, p.fKnee, p.fFoot, COL.limbFar, COL.footFar);

  // Body (head + torso as one rounded shape) with a crisp outline.
  rrect(4, 3, 16, 18, 7, COL.body);
  g.lineStyle(2 * sAvg, COL.outline, 1);
  g.strokeRoundedRect(4 * sx, 3 * sy, 16 * sx, 18 * sy, 7 * sAvg);
  g.fillStyle(COL.belly, 1);
  g.fillEllipse(12 * sx, 15 * sy, 9 * sx, 7 * sy);

  // Eyes (face right) + sprout.
  circle(8.6, 9, 3, 0xffffff);
  circle(15.4, 9, 3, 0xffffff);
  circle(9.6, 9, 1.5, 0x16252e);
  circle(16.4, 9, 1.5, 0x16252e);
  g.fillStyle(0x3f8f2f, 1);
  g.fillRect(11 * sx, 0, 2 * sx, 4 * sy);
  circle(14, 1.5, 2.4, 0x6abe30);

  // Front (near) limbs.
  drawLeg(nearHip, p.nKnee, p.nFoot, COL.limb, COL.foot);
  drawArm(nearSh, p.nHand, COL.limb);
}

/** Generate Lumio's frame textures for both sizes. */
function createPlayerFrames(scene: Phaser.Scene): void {
  const gen = (key: string, w: number, h: number, pose: LumioPose) => {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    drawLumio(g, w, h, pose);
    g.generateTexture(key, w, h);
    g.destroy();
  };
  const sizes = [
    { t: PlayerArt.tex.small, w: 24, h: 32 },
    { t: PlayerArt.tex.big, w: 30, h: 46 },
  ];
  for (const { t, w, h } of sizes) {
    gen(t.idle, w, h, "idle");
    gen(t.run0, w, h, "run0");
    gen(t.run1, w, h, "run1");
    gen(t.run2, w, h, "run2");
    gen(t.run3, w, h, "run3");
    gen(t.jump, w, h, "jump");
  }
}

/** Small tintable particle bits (spark, crumb, dust puff). */
function createParticleTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(TextureKeys.Spark)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(3, 3, 3);
    g.generateTexture(TextureKeys.Spark, 6, 6);
    g.destroy();
  }
  if (!scene.textures.exists(TextureKeys.Puff)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture(TextureKeys.Puff, 8, 8);
    g.destroy();
  }
  if (!scene.textures.exists(TextureKeys.Crumb)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xb5532e, 1);
    g.fillRect(0, 0, 5, 5);
    g.fillStyle(0xe0a878, 1);
    g.fillRect(0, 0, 5, 2);
    g.generateTexture(TextureKeys.Crumb, 5, 5);
    g.destroy();
  }
}

/** Generate every world texture. Safe to call once in PreloadScene. */
export function createWorldTextures(scene: Phaser.Scene): void {
  createTileset(scene);
  createSky(scene);
  createHills(scene, TextureKeys.HillsFar, 384, 200, 150, 50, 3, 0x9ec7a8, 0xb6d9bf);
  createHills(scene, TextureKeys.HillsNear, 384, 220, 200, 80, 2, 0x5fa05f, 0x7bc07b);
  createBeacon(scene);
  createCoin(scene);
  createGrowcap(scene);
  createEntityBlocks(scene);
  createPlodder(scene);
  createSnapvine(scene);
  createPipe(scene);
  createPlayerFrames(scene);
  createParticleTextures(scene);
}

/** Register Lumio's animations (global; call once in PreloadScene). */
export function registerPlayerAnimations(scene: Phaser.Scene): void {
  const def = (key: string, frames: string[], frameRate: number) => {
    if (scene.anims.exists(key)) return;
    scene.anims.create({
      key,
      frames: frames.map((f) => ({ key: f })),
      frameRate,
      repeat: -1,
    });
  };
  const A = PlayerArt.anim;
  const S = PlayerArt.tex.small;
  const B = PlayerArt.tex.big;
  def(A.small.idle, [S.idle], 1);
  def(A.small.run, [S.run0, S.run1, S.run2, S.run3], 12);
  def(A.small.jump, [S.jump], 1);
  def(A.big.idle, [B.idle], 1);
  def(A.big.run, [B.run0, B.run1, B.run2, B.run3], 12);
  def(A.big.jump, [B.jump], 1);
}
