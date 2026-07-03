import Phaser from "phaser";
import { TextureKeys, EnemyAnim } from "@/config/AssetKeys";
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

// ----- Individual tile painters (each draws one 32px cell at offset ox) -----

/** Smooth soil body from y0 down, with a few soft pebbles (clean, modern). */
function paintDirtBody(g: Phaser.GameObjects.Graphics, ox: number, y0: number): void {
  const h = TILE_SIZE - y0;
  px(g, ox, y0, TILE_SIZE, h, 0x7a4e29); // base
  px(g, ox, y0, TILE_SIZE, Math.max(3, Math.round(h * 0.32)), 0x8a5b31); // lit upper
  px(g, ox, TILE_SIZE - 4, TILE_SIZE, 4, 0x68401f); // shaded bottom
  g.fillStyle(0x5c3a1f, 1); // darker pebbles
  g.fillCircle(ox + 8, y0 + 9, 2.2);
  g.fillCircle(ox + 23, y0 + 15, 2.6);
  g.fillStyle(0x9a6a3e, 0.9); // lighter grains
  g.fillCircle(ox + 16, y0 + 6, 1.5);
  g.fillCircle(ox + 27, y0 + Math.min(18, h - 5), 1.7);
}

function paintGrassTop(g: Phaser.GameObjects.Graphics, ox: number): void {
  paintDirtBody(g, ox, 11); // soil under the grass band
  // Smooth grass band with a soft vertical gradient + crisp top highlight.
  px(g, ox, 0, TILE_SIZE, 12, 0x57a82c);
  px(g, ox, 0, TILE_SIZE, 7, 0x66bd35);
  px(g, ox, 0, TILE_SIZE, 4, 0x77d23f);
  px(g, ox, 0, TILE_SIZE, 2, 0x93e85a); // bright crest
  px(g, ox, 11, TILE_SIZE, 2, 0x356a1a); // soft grass/soil seam
}

function paintDirt(g: Phaser.GameObjects.Graphics, ox: number): void {
  paintDirtBody(g, ox, 0);
}

function paintStone(g: Phaser.GameObjects.Graphics, ox: number): void {
  // Clean, modern beveled block.
  px(g, ox, 0, TILE_SIZE, TILE_SIZE, 0x9aa6bd); // base
  px(g, ox + 2, 2, TILE_SIZE - 4, TILE_SIZE - 4, 0xaab6cc); // inner panel
  px(g, ox, 0, TILE_SIZE, 3, 0xd2dceb); // bright top bevel
  px(g, ox, 0, 3, TILE_SIZE, 0xc2cee0); // left bevel
  px(g, ox, TILE_SIZE - 3, TILE_SIZE, 3, 0x6a7488); // bottom shade
  px(g, ox + TILE_SIZE - 3, 0, 3, TILE_SIZE, 0x778199); // right shade
  // corner studs for a toy-like feel
  const stud = 0x5f6a80;
  px(g, ox + 4, 4, 2, 2, stud);
  px(g, ox + 26, 4, 2, 2, stud);
  px(g, ox + 4, 26, 2, 2, stud);
  px(g, ox + 26, 26, 2, 2, stud);
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
  // Beveled, glossy gold block.
  px(g, ox, 0, TILE_SIZE, TILE_SIZE, 0xe6a92e); // base
  px(g, ox, 0, TILE_SIZE, 3, 0xffe79a); // bright top bevel
  px(g, ox, 0, 3, TILE_SIZE, 0xffdd7d); // left bevel
  px(g, ox, TILE_SIZE - 3, TILE_SIZE, 3, 0xb27d12); // bottom shade
  px(g, ox + TILE_SIZE - 3, 0, 3, TILE_SIZE, 0xc28e1c); // right shade
  // diagonal gloss streak
  g.fillStyle(0xfff2c2, 0.5);
  g.fillTriangle(ox + 6, 4, ox + 16, 4, ox + 6, 14);
  // corner rivets
  const rivet = 0x7a5310;
  px(g, ox + 4, 4, 2, 2, rivet);
  px(g, ox + 26, 4, 2, 2, rivet);
  px(g, ox + 4, 26, 2, 2, rivet);
  px(g, ox + 26, 26, 2, 2, rivet);
  // blocky "?" glyph with a soft drop shadow
  const ink = 0x6e4408;
  const lit = 0xfff4d0;
  const glyph = (c: number, dx: number, dy: number) => {
    px(g, ox + 11 + dx, 8 + dy, 9, 3, c);
    px(g, ox + 18 + dx, 10 + dy, 3, 5, c);
    px(g, ox + 12 + dx, 14 + dy, 7, 3, c);
    px(g, ox + 14 + dx, 16 + dy, 3, 5, c);
    px(g, ox + 14 + dx, 24 + dy, 3, 3, c);
  };
  glyph(ink, 1, 1); // shadow
  glyph(lit, 0, 0); // glyph
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

/** Bright gradient sky with a soft sun glow in the upper area. */
function createSky(scene: Phaser.Scene): void {
  if (scene.textures.exists(TextureKeys.Sky)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const top = Phaser.Display.Color.ValueToColor(0x49b6ef); // vivid sky blue
  const bottom = Phaser.Display.Color.ValueToColor(0xcde8c0); // pale green haze
  for (let y = 0; y < GAME_HEIGHT; y++) {
    const t = y / (GAME_HEIGHT - 1);
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, 100, Math.floor(t * 100));
    px(g, 0, y, GAME_WIDTH, 1, Phaser.Display.Color.GetColor(c.r, c.g, c.b));
  }
  // Soft sun glow (stacked translucent circles) in the upper-right.
  const sx = GAME_WIDTH * 0.72;
  const sy = GAME_HEIGHT * 0.26;
  for (let i = 6; i >= 1; i--) {
    g.fillStyle(0xffffff, 0.05);
    g.fillCircle(sx, sy, i * 22);
  }
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(sx, sy, 16);
  g.generateTexture(TextureKeys.Sky, GAME_WIDTH, GAME_HEIGHT);
  g.destroy();
}

/**
 * Sleek, modern menu backdrop: a deep vertical gradient with soft glowing orbs
 * (bokeh) and a gentle vignette — a clean, non-pixel look distinct from the
 * gameplay world.
 */
function createMenuBackdrop(scene: Phaser.Scene): void {
  if (scene.textures.exists(TextureKeys.MenuBg)) return;
  const w = GAME_WIDTH;
  const h = GAME_HEIGHT;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  const top = Phaser.Display.Color.ValueToColor(0x141e3c); // deep indigo
  const bottom = Phaser.Display.Color.ValueToColor(0x2f8aa3); // teal
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, 100, Math.floor(t * 100));
    px(g, 0, y, w, 1, Phaser.Display.Color.GetColor(c.r, c.g, c.b));
  }

  // Soft glowing orbs (layered translucent circles = blurry bokeh).
  const orbs: Array<[number, number, number, number]> = [
    [110, 80, 70, 0x4fd6c4],
    [540, 70, 60, 0x5aa6ec],
    [470, 300, 110, 0x37c8aa],
    [70, 310, 60, 0x4a86e0],
    [320, 150, 50, 0x6fe0d0],
  ];
  for (const [ox, oy, r, color] of orbs) {
    for (let i = 5; i >= 1; i--) {
      g.fillStyle(color, 0.05);
      g.fillCircle(ox, oy, (r * i) / 3);
    }
  }

  // Subtle vignette: darken the four edges.
  for (let i = 0; i < 10; i++) {
    g.fillStyle(0x0a1226, 0.05);
    g.fillRect(0, i * 4, w, 4); // top
    g.fillRect(0, h - (i + 1) * 4, w, 4); // bottom
    g.fillRect(i * 4, 0, 4, h); // left
    g.fillRect(w - (i + 1) * 4, 0, 4, h); // right
  }

  g.generateTexture(TextureKeys.MenuBg, w, h);
  g.destroy();
}

/** Soft diagonal god-rays on a transparent strip (drawn additively in-scene). */
function createRays(scene: Phaser.Scene): void {
  if (scene.textures.exists(TextureKeys.Rays)) return;
  const w = 512;
  const h = GAME_HEIGHT;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const slant = 90; // horizontal offset from top to bottom (diagonal beams)
  const beams = [
    { x: 40, width: 26 }, { x: 150, width: 40 }, { x: 250, width: 20 },
    { x: 340, width: 48 }, { x: 450, width: 30 },
  ];
  for (const b of beams) {
    g.fillStyle(0xffffff, 0.10);
    // a parallelogram from top to bottom, slanted right
    g.fillPoints(
      [
        { x: b.x, y: 0 },
        { x: b.x + b.width, y: 0 },
        { x: b.x + b.width + slant, y: h },
        { x: b.x + slant, y: h },
      ],
      true
    );
  }
  g.generateTexture(TextureKeys.Rays, w, h);
  g.destroy();
}

/**
 * Fluffy foliage layer: a row of overlapping bumps (circle clusters) with a
 * lighter top rim and a darker base, built periodically so it tiles seamlessly.
 */
function createFoliageLayer(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  baseY: number,
  bumpR: number,
  spacing: number,
  body: number,
  rim: number,
  shadow: number
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Solid body below the bump line.
  px(g, 0, baseY, width, height - baseY, body);

  // Bumpy crown — main bumps plus smaller in-between bumps (periodic => tiles).
  const drawBumps = (r: number, yOff: number, color: number, phase: number) => {
    g.fillStyle(color, 1);
    for (let x = -spacing; x <= width + spacing; x += spacing) {
      g.fillCircle(x + phase, baseY + yOff, r);
    }
  };
  drawBumps(bumpR, 0, body, 0);
  drawBumps(bumpR * 0.7, 2, body, spacing / 2);
  // Lighter rim caps sitting just above the bumps.
  drawBumps(bumpR - 4, -4, rim, 0);
  drawBumps(bumpR * 0.7 - 3, -2, rim, spacing / 2);

  // Soft shadow gradient toward the bottom for depth.
  for (let i = 0; i < 8; i++) {
    g.fillStyle(shadow, 0.06);
    g.fillRect(0, height - (i + 1) * 6, width, 6);
  }
  g.generateTexture(key, width, height);
  g.destroy();
}

/** A spinning gold coin (animated in-engine via a scaleX flip tween). */
function createCoin(scene: Phaser.Scene): void {
  if (scene.textures.exists(TextureKeys.Coin)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const r = 11;
  g.fillStyle(0xb8830f, 1); // dark rim
  g.fillCircle(r, r, r);
  g.fillStyle(0xffd24a, 1); // gold face
  g.fillCircle(r, r, r - 2);
  // glossy vertical gradient: brighter toward the top
  g.fillStyle(0xffe88f, 1);
  g.fillEllipse(r, r - 2, (r - 3) * 2, (r - 5) * 2);
  g.fillStyle(0xd99a17, 1); // engraved center bar
  g.fillRect(r - 1, 5, 2, 12);
  g.fillStyle(0xffffff, 0.95); // bright specular highlight (top-left)
  g.fillEllipse(r - 3, r - 4, 5, 7);
  g.fillStyle(0xffffff, 0.6);
  g.fillCircle(r + 3, r + 3, 1.4); // small secondary glint
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
  // feet with shading
  px(g, 4, 20, 7, 4, 0x3d230e);
  px(g, 4, 20, 7, 2, 0x5a3617);
  px(g, 17, 20, 7, 4, 0x3d230e);
  px(g, 17, 20, 7, 2, 0x5a3617);
  // body
  g.fillStyle(0x8a5222, 1); // dark shadow base
  g.fillEllipse(w / 2, 13, 26, 22);
  g.fillStyle(0xa9692f, 1); // mid tone
  g.fillEllipse(w / 2, 12, 26, 20);
  g.fillStyle(0xc4854a, 1); // lighter top highlight
  g.fillEllipse(w / 2, 9, 22, 12);
  // eyes
  px(g, 8, 9, 5, 6, 0xffffff);
  px(g, 16, 9, 5, 6, 0xffffff);
  px(g, 10, 11, 2, 3, 0x9e1717); // red evil pupils
  px(g, 18, 11, 2, 3, 0x9e1717);
  px(g, 11, 11, 1, 1, 0xffffff); // glint
  px(g, 19, 11, 1, 1, 0xffffff);
  // angry brows
  px(g, 7, 7, 6, 3, 0x2e190a);
  px(g, 16, 7, 6, 3, 0x2e190a);
  g.generateTexture(TextureKeys.Plodder, w, h);
  g.destroy();
}

// Snapvine palette: classic piranha-plant look — red spotted bulb, white jaws.
const SV_OUT = 0x1c1310; // dark outline
const SV_RED = 0xc22a10;
const SV_RED_D = 0x86170a;
const SV_RED_H = 0xe8563c;
const SV_WHITE = 0xf4f2ec;
const SV_WHITE_D = 0xc7c4ba;
const SV_GREEN = 0x2aa03c;
const SV_GREEN_D = 0x17632a;
const SV_GREEN_H = 0x66d876;

/** Stem + drooping leaf pair shared by every Snapvine animation frame. */
function paintSnapvineStem(g: Phaser.GameObjects.Graphics, cx: number, stemTop: number, stemH: number): void {
  px(g, cx - 3, stemTop, 6, stemH, SV_GREEN_D);
  px(g, cx - 3, stemTop, 3, stemH, SV_GREEN);
  px(g, cx - 3, stemTop, 1, stemH, SV_GREEN_H);
  // two long leaves arching out from the base of the stem
  const ly = stemTop + stemH - 4;
  g.fillStyle(SV_GREEN_D, 1);
  g.fillTriangle(cx - 14, ly - 5, cx - 3, ly - 2, cx - 3, ly + 4);
  g.fillTriangle(cx + 14, ly - 5, cx + 3, ly - 2, cx + 3, ly + 4);
  g.fillStyle(SV_GREEN, 1);
  g.fillTriangle(cx - 13, ly - 4, cx - 3, ly - 1, cx - 3, ly + 3);
  g.fillTriangle(cx + 13, ly - 4, cx + 3, ly - 1, cx + 3, ly + 3);
  g.fillStyle(SV_GREEN_H, 1);
  g.fillTriangle(cx - 12, ly - 4, cx - 6, ly - 2, cx - 4, ly + 1);
  g.fillTriangle(cx + 12, ly - 4, cx + 6, ly - 2, cx + 4, ly + 1);
}

/** Red spotted bulb (the head/cup). `bw`/`bh` are the full ellipse sizes. */
function paintSnapvineBulb(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  bw: number,
  bh: number
): void {
  g.fillStyle(SV_OUT, 1);
  g.fillEllipse(cx, cy, bw + 3, bh + 3);
  g.fillStyle(SV_RED_D, 1);
  g.fillEllipse(cx, cy, bw, bh);
  g.fillStyle(SV_RED, 1);
  g.fillEllipse(cx - 1, cy - 1, bw - 4, bh - 4);
  g.fillStyle(SV_RED_H, 1);
  g.fillEllipse(cx - bw * 0.2, cy - bh * 0.2, bw * 0.3, bh * 0.24);
  // trademark white spots
  g.fillStyle(SV_WHITE, 1);
  g.fillCircle(cx - 6, cy + 2, 2.6);
  g.fillCircle(cx + 5, cy + 4, 3.1);
  g.fillCircle(cx + 8, cy - 3, 2.0);
  g.fillCircle(cx - 9, cy - 3, 1.8);
  g.fillCircle(cx, cy + bh * 0.32, 1.6);
  g.fillStyle(SV_WHITE_D, 1);
  g.fillCircle(cx + 1, cy - 1, 1.4);
}

/**
 * One white jaw of the open trap: a thick strip from the mouth centre out to
 * `(dx, dy)`, dark-outlined, with small teeth serrating the edge that faces
 * the V-shaped opening. `dx < 0` draws the left jaw, `dx > 0` the right one.
 */
function paintSnapvineJaw(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  mouthY: number,
  dx: number,
  dy: number
): void {
  const s = Math.sign(dx);
  const pts = [
    new Phaser.Geom.Point(cx, mouthY + 4), // bottom, at the mouth centre
    new Phaser.Geom.Point(cx + dx, mouthY + dy + 5), // bottom of the tip
    new Phaser.Geom.Point(cx + dx - s, mouthY + dy - 6), // top of the tip
    new Phaser.Geom.Point(cx - s * 2, mouthY - 7), // top, at the mouth centre
  ];
  g.fillStyle(SV_WHITE, 1);
  g.fillPoints(pts, true);
  g.lineStyle(2, SV_OUT, 1);
  g.strokePoints(pts, true, true);
  g.lineStyle(0, 0, 0);
  // shading along the underside
  g.fillStyle(SV_WHITE_D, 1);
  g.fillTriangle(pts[0].x, pts[0].y, pts[1].x, pts[1].y, pts[0].x + s * 3, pts[0].y - 4);
  // teeth along the top edge, pointing into the V opening
  g.fillStyle(SV_WHITE, 1);
  const [bx, by] = [pts[3].x, pts[3].y];
  const [ex, ey] = [pts[2].x - bx, pts[2].y - by];
  for (const t of [0.25, 0.55, 0.82]) {
    const tx = bx + ex * t;
    const ty = by + ey * t;
    g.fillTriangle(tx, ty, tx + ex * 0.2, ty + ey * 0.2, tx + ex * 0.1 - s * 4, ty - 5);
  }
}

/** Idle head: the red bulb with the white jaws resting shut across the top. */
function paintSnapvineClosedHead(g: Phaser.GameObjects.Graphics, cx: number, stemTop: number): void {
  const cy = stemTop - 12;
  paintSnapvineBulb(g, cx, cy, 26, 24);
  // closed white jaws: a flattened lens capping the bulb, seam serrated
  g.fillStyle(SV_OUT, 1);
  g.fillEllipse(cx, cy - 8, 26, 13);
  g.fillStyle(SV_WHITE_D, 1);
  g.fillEllipse(cx, cy - 8, 23, 10);
  g.fillStyle(SV_WHITE, 1);
  g.fillEllipse(cx, cy - 10, 23, 7);
  px(g, cx - 10, cy - 8, 20, 1, SV_OUT); // seam between the shut jaws
  g.fillStyle(SV_OUT, 1);
  for (const tx of [cx - 8, cx - 2, cx + 4]) {
    g.fillTriangle(tx, cy - 8, tx + 2, cy - 5, tx + 4, cy - 8);
  }
}

/** Bite pose: red cup below, dark throat, two white jaws spread in a V. */
function paintSnapvineOpenHead(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  mouthY: number,
  fullyOpen: boolean
): void {
  paintSnapvineBulb(g, cx, mouthY + 9, 26, 22);
  g.fillStyle(0x2a0503, 1); // throat cavity in the cup's opening
  g.fillEllipse(cx, mouthY + 3, 17, 9);
  if (fullyOpen) {
    g.fillStyle(0xd8453f, 1); // tongue
    g.fillEllipse(cx, mouthY + 4, 8, 5);
  }
  const lift = fullyOpen ? 17 : 10;
  const tipDx = fullyOpen ? 13 : 10;
  paintSnapvineJaw(g, cx, mouthY, -tipDx, -lift);
  paintSnapvineJaw(g, cx, mouthY, tipDx, -lift);
}

/**
 * Draws one Snapvine animation frame into `g`. `stage` 0 is the idle, fully
 * closed bulb; 1/2 are increasingly wide bite poses — the white jaws spread
 * into the trademark V above the red cup. Canvas height grows with the stage
 * so the extra reach has headroom without shifting the feet anchor.
 */
function paintSnapvineFrame(
  g: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  stage: 0 | 1 | 2
): void {
  const cx = w / 2;
  const stemTop = h - 14;
  paintSnapvineStem(g, cx, stemTop, 14);
  if (stage === 0) {
    paintSnapvineClosedHead(g, cx, stemTop);
    return;
  }
  paintSnapvineOpenHead(g, cx, stemTop - 20, stage === 2);
}

/** Snapvine: a biting plant that lives in a pipe (origin anchored at the feet). */
function createSnapvine(scene: Phaser.Scene): void {
  const build = (key: string, w: number, h: number, stage: 0 | 1 | 2) => {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    paintSnapvineFrame(g, w, h, stage);
    g.generateTexture(key, w, h);
    g.destroy();
  };
  build(TextureKeys.Snapvine, 30, 46, 0);
  build(TextureKeys.SnapvineMid, 32, 58, 1);
  build(TextureKeys.SnapvineOpen, 34, 68, 2);

  if (!scene.anims.exists(EnemyAnim.snapvineBite)) {
    scene.anims.create({
      key: EnemyAnim.snapvineBite,
      frameRate: 10,
      repeat: -1,
      frames: [
        { key: TextureKeys.Snapvine, duration: 220 },
        { key: TextureKeys.SnapvineMid, duration: 90 },
        { key: TextureKeys.SnapvineOpen, duration: 380 },
        { key: TextureKeys.SnapvineMid, duration: 90 },
        { key: TextureKeys.Snapvine, duration: 260 },
      ],
    });
  }
}

/** Pipe: a green obstacle with a hollow mouth the Snapvine emerges from. */
function createPipe(scene: Phaser.Scene): void {
  if (scene.textures.exists(TextureKeys.Pipe)) return;
  const w = 64;
  const h = 80;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // shaft (inset under the rim)
  px(g, 4, 16, w - 8, h - 16, 0x228731); // base dark green
  px(g, 8, 16, w - 16, h - 16, 0x3aa34a); // mid green
  px(g, 10, 16, 10, h - 16, 0x77e086); // bright left highlight
  px(g, w - 16, 16, 8, h - 16, 0x186123); // right shadow
  // rim (full width, slightly taller band)
  px(g, 0, 0, w, 18, 0x1d752a);
  px(g, 0, 0, w, 16, 0x2f8a3d);
  px(g, 4, 0, 10, 16, 0x77e086); // rim highlight matching shaft
  px(g, w - 12, 0, 10, 16, 0x186123); // rim shadow
  px(g, 0, 0, w, 3, 0x9bf5a8); // very bright rim top sheen
  px(g, 0, 15, w, 3, 0x134d1b); // rim base shadow
  // hollow mouth
  px(g, 8, 3, w - 16, 13, 0x071f0a);
  px(g, 10, 4, w - 20, 11, 0x123a18);
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

/** Goal beacon: a pole with a glowing top, drawn once. The pennant is a
 * separate texture so it can slide down the pole with the player. */
function createBeacon(scene: Phaser.Scene): void {
  if (!scene.textures.exists(TextureKeys.Beacon)) {
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
    g.generateTexture(TextureKeys.Beacon, w, h);
    g.destroy();
  }
  if (!scene.textures.exists(TextureKeys.BeaconFlag)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xff5d73, 1);
    g.fillTriangle(0, 0, 18, 10, 0, 20);
    g.fillStyle(0xffffff, 0.25);
    g.fillTriangle(0, 0, 9, 5, 0, 10);
    g.generateTexture(TextureKeys.BeaconFlag, 19, 21);
    g.destroy();
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
  createRays(scene);
  createMenuBackdrop(scene);
  // Distant, hazy foliage then closer, richer foliage — softer, atmospheric
  // palette (aerial perspective: far layer lighter/cooler) with smoother bumps.
  createFoliageLayer(scene, TextureKeys.HillsFar, 512, 220, 96, 58, 84, 0xa9d3c0, 0xc8e8d6, 0x6a9b86);
  createFoliageLayer(scene, TextureKeys.HillsNear, 512, 240, 120, 74, 104, 0x66b585, 0x8fd2a2, 0x357a55);
  createBeacon(scene);
  createCoin(scene);
  createGrowcap(scene);
  createEntityBlocks(scene);
  createPlodder(scene);
  createSnapvine(scene);
  createPipe(scene);
  createParticleTextures(scene);
}
