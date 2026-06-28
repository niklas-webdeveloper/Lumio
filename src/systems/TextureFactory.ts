import Phaser from "phaser";
import { TextureKeys } from "@/config/AssetKeys";
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

/** Generate every world texture. Safe to call once in PreloadScene. */
export function createWorldTextures(scene: Phaser.Scene): void {
  createTileset(scene);
  createSky(scene);
  createHills(scene, TextureKeys.HillsFar, 384, 200, 150, 50, 3, 0x9ec7a8, 0xb6d9bf);
  createHills(scene, TextureKeys.HillsNear, 384, 220, 200, 80, 2, 0x5fa05f, 0x7bc07b);
  createBeacon(scene);
}
