#!/usr/bin/env python3
"""
Build every asset of the "lagoon" theme (level 7, "Tropic Lagoon") from the
SunnyLand pack in new_assets — the same hand-pixelled art family the base game
already uses, so the stage fits the game's look while reading clearly tropical:

  terrain-lagoon.png   10-GID terrain strip (32px tiles, 2px extrusion):
                       grass/dirt from the SunnyLand tileset, a wooden block
                       and a log branch as the two floating-platform tiles,
                       purple cave bricks + a leaf hedge for the bonus room,
                       and prop spikes as the hazard.
  backgrounds/lagoon/  5 parallax layers (1600x800, L0 opaque, L1-L4 alpha,
                       all periodic over 1600): SunnyLand ocean sky, then
                       receding jungle-canopy silhouettes with palms.
  sprites/enemies/frog.png   6-frame strip (35x32): idle x4, jump, fall.
  sprites/decor/lagoon/      ground-scatter props (shrooms, bush, rock, …).

Usage:  python3 scripts/build-lagoon-art.py
"""

import math
import random
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SL = ROOT / "new_assets" / "SunnyLand Artwork"
ENV = SL / "Environment"
TILESET = ENV / "Tileset" / "tileset-sliced.png"
PROPS = ENV / "props"
OUT_TILES = ROOT / "public" / "assets" / "tilesets"
OUT_BG = ROOT / "public" / "assets" / "backgrounds" / "lagoon"
OUT_SPRITES = ROOT / "public" / "assets" / "sprites"

TILE = 32
EXTRUDE = 2
W, H = 1600, 800  # parallax layer size (matches every other theme)


# ---------- shared helpers (mirror build-themed-tiles.py) ----------

def extrude(tile: Image.Image, border: int) -> Image.Image:
    w, h = tile.size
    out = Image.new("RGBA", (w + border * 2, h + border * 2), (0, 0, 0, 0))
    out.paste(tile, (border, border))
    for i in range(border):
        out.paste(tile.crop((0, 0, w, 1)), (border, i))
        out.paste(tile.crop((0, h - 1, w, h)), (border, h + border + i))
    for i in range(border):
        col = out.crop((border, 0, border + 1, h + border * 2))
        out.paste(col, (i, 0))
        col = out.crop((w + border - 1, 0, w + border, h + border * 2))
        out.paste(col, (w + border + i, 0))
    return out


def pack(tiles32, path: Path) -> None:
    padded = TILE + EXTRUDE * 2
    strip = Image.new("RGBA", (padded * len(tiles32), padded), (0, 0, 0, 0))
    for i, t in enumerate(tiles32):
        strip.paste(extrude(t.convert("RGBA"), EXTRUDE), (i * padded, 0))
    strip.save(path)
    print(f"{path.relative_to(ROOT)}: {strip.size}")


def x2(im: Image.Image) -> Image.Image:
    return im.resize((im.width * 2, im.height * 2), Image.NEAREST)


# ---------- terrain tiles ----------

def cell(sheet: Image.Image, cx: int, cy: int, w: int = 1, h: int = 1) -> Image.Image:
    return sheet.crop((cx * 16, cy * 16, (cx + w) * 16, (cy + h) * 16))


def build_terrain() -> None:
    sheet = Image.open(TILESET).convert("RGBA")

    grass = x2(cell(sheet, 1, 1))       # green crest over tropical dirt
    dirt = x2(cell(sheet, 1, 3))        # rocky dirt fill
    block = Image.open(PROPS / "block-big.png").convert("RGBA")  # wooden block
    brick = cell(sheet, 14, 16, 2, 2)   # purple cave bricks (bonus room)
    hedge = cell(sheet, 13, 20, 2, 2)   # dark leaf hedge (bonus room deco)
    log = x2(cell(sheet, 10, 1))        # log branch (floating step, has alpha)

    # Spikes: the 15x10 prop, doubled and bottom-centred on a transparent tile.
    sp = x2(Image.open(PROPS / "spikes.png").convert("RGBA"))
    spike = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
    spike.alpha_composite(sp, ((TILE - sp.width) // 2, TILE - sp.height))

    tiles = [
        grass,   # 1 GrassTop
        dirt,    # 2 Dirt
        block,   # 3 Stone (wooden block platform)
        brick,   # 4 Brick (bonus-room walls)
        block,   # 5 Lucky (unused in terrain)
        hedge,   # 6 Used (bonus-room leaf hedge)
        spike,   # 7 Spike
        log,     # 8 Plate (log branch floating step)
        dirt,    # 9 Quicksand (unused)
        dirt,    # 10 Ice (unused)
    ]
    OUT_TILES.mkdir(parents=True, exist_ok=True)
    pack(tiles, OUT_TILES / "terrain-lagoon.png")


# ---------- parallax background ----------

def tint(im: Image.Image, color, keep=0.0) -> Image.Image:
    """Recolor opaque pixels toward `color`, keeping `keep` of the original
    (0 = flat silhouette, 1 = untouched). Alpha is preserved."""
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            px[x, y] = (
                int(color[0] * (1 - keep) + r * keep),
                int(color[1] * (1 - keep) + g * keep),
                int(color[2] * (1 - keep) + b * keep),
                a,
            )
    return out


def shade(im: Image.Image, f: float) -> Image.Image:
    """Multiply RGB by f (alpha preserved)."""
    r, g, b, a = im.split()
    r = r.point(lambda v: int(v * f))
    g = g.point(lambda v: int(v * f))
    b = b.point(lambda v: int(v * f))
    return Image.merge("RGBA", (r, g, b, a))


def canopy_row(middle: Image.Image, count: int, y_base: int, amp: int,
               phase: float, mirror_odd: bool) -> Image.Image:
    """A layer-sized row of jungle-canopy silhouettes, periodic over W: `count`
    copies spaced evenly, bobbing on a sine so the treeline rolls."""
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    spacing = W / count
    for i in range(count):
        im = middle
        if mirror_odd and i % 2 == 1:
            im = middle.transpose(Image.FLIP_LEFT_RIGHT)
        x = int(i * spacing - (im.width - spacing) / 2)
        y = int(y_base + amp * math.sin(2 * math.pi * i / count + phase))
        for ox in (-W, 0, W):
            layer.alpha_composite(im, (x + ox, y))
    # Fill straight down to the bottom edge (the source is solid below its
    # canopy, but may end above y=H after placement).
    return layer


def solid_below(layer: Image.Image, color) -> Image.Image:
    """Extend each column's lowest opaque pixel down to the bottom edge."""
    px = layer.load()
    for x in range(W):
        painting = False
        for y in range(H):
            a = px[x, y][3]
            if a > 200:
                painting = True
            elif painting and a < 200:
                px[x, y] = (*color, 255)
    return layer


def silhouettes(props, count, y_ground, color, seed, scale=2) -> Image.Image:
    """Sparse palm/tree silhouettes standing on y_ground, periodic over W."""
    rng = random.Random(seed)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for i in range(count):
        name = props[rng.randrange(len(props))]
        im = Image.open(PROPS / name).convert("RGBA")
        im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
        im = tint(im, color, keep=0.15)
        if rng.random() < 0.5:
            im = im.transpose(Image.FLIP_LEFT_RIGHT)
        x = int(i * W / count + rng.uniform(-60, 60))
        y = y_ground - im.height + rng.randint(-8, 8)
        for ox in (-W, 0, W):
            layer.alpha_composite(im, (x + ox, y))
    return layer


def build_backgrounds() -> None:
    OUT_BG.mkdir(parents=True, exist_ok=True)

    # L0 — SunnyLand ocean sky, made periodic over 1600 (384 -> 400 -> x4)
    # and cropped so the horizon sits at ~55% of the layer height.
    back = Image.open(ENV / "back.png").convert("RGBA")
    back = back.resize((400, 250), Image.NEAREST)
    back = back.resize((1600, 1000), Image.NEAREST)
    l0 = back.crop((0, 100, 1600, 900))
    l0.save(OUT_BG / "L0.png")
    print("  lagoon/L0.png")

    middle = Image.open(ENV / "middle.png").convert("RGBA")
    mid_body = (43, 63, 77)  # solid body color of middle.png below its canopy

    # L1 — far canopy: hazy, lifted toward the sky color.
    far = middle.resize((int(middle.width * 2.2), int(middle.height * 2.2)), Image.NEAREST)
    l1 = canopy_row(far, 5, 330, 26, 0.0, mirror_odd=True)
    l1 = solid_below(l1, mid_body)
    l1 = tint(l1, (116, 190, 190), keep=0.30)
    l1.save(OUT_BG / "L1.png")
    print("  lagoon/L1.png")

    # L2 — mid canopy: the artwork's own colors (it IS the pack's mid layer).
    mid = middle.resize((int(middle.width * 2.6), int(middle.height * 2.6)), Image.NEAREST)
    l2 = canopy_row(mid, 4, 420, 34, 1.7, mirror_odd=True)
    l2 = solid_below(l2, mid_body)
    l2.save(OUT_BG / "L2.png")
    print("  lagoon/L2.png")

    # L3 — near treeline: darker canopy + palm/pine silhouettes on top.
    near = middle.resize((int(middle.width * 3.0), int(middle.height * 3.0)), Image.NEAREST)
    l3 = canopy_row(near, 3, 520, 30, 3.1, mirror_odd=True)
    l3 = solid_below(l3, mid_body)
    l3 = shade(l3, 0.62)
    palms = silhouettes(["palm.png", "tree.png", "pine.png"], 5, 660,
                        (16, 42, 46), seed=7, scale=2)
    l3.alpha_composite(palms)
    l3.save(OUT_BG / "L3.png")
    print("  lagoon/L3.png")

    # L4 — foreground: a low dark shore ridge with sparse tall palms.
    l4 = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = l4.load()
    for x in range(W):
        ridge = int(H - 46 + 10 * math.sin(2 * math.pi * 3 * x / W)
                    + 6 * math.sin(2 * math.pi * 7 * x / W + 1.3))
        for y in range(ridge, H):
            px[x, y] = (10, 30, 34, 255)
    fg_palms = silhouettes(["palm.png", "pine.png"], 3, H - 20,
                           (8, 24, 28), seed=21, scale=3)
    l4.alpha_composite(fg_palms)
    l4.save(OUT_BG / "L4.png")
    print("  lagoon/L4.png")


# ---------- frog enemy strip ----------

def build_frog() -> None:
    frames = [
        SL / "Sprites" / "Enemies" / "frog" / "idle" / f"frog-idle-{i}.png"
        for i in (1, 2, 3, 4)
    ] + [
        SL / "Sprites" / "Enemies" / "frog" / "jump" / "frog-jump-1.png",
        SL / "Sprites" / "Enemies" / "frog" / "jump" / "frog-fall.png",
    ]
    fw, fh = 35, 32
    strip = Image.new("RGBA", (fw * len(frames), fh), (0, 0, 0, 0))
    for i, p in enumerate(frames):
        strip.alpha_composite(Image.open(p).convert("RGBA"), (i * fw, 0))
    out = OUT_SPRITES / "enemies"
    out.mkdir(parents=True, exist_ok=True)
    strip.save(out / "frog.png")
    print(f"sprites/enemies/frog.png: {strip.size} ({len(frames)} frames {fw}x{fh})")


# ---------- ground-scatter decor ----------

DECOR = ["shrooms.png", "bush.png", "sign.png", "rock-1.png", "tree.png", "palm.png"]


def build_decor() -> None:
    out = OUT_SPRITES / "decor" / "lagoon"
    out.mkdir(parents=True, exist_ok=True)
    for name in DECOR:
        Image.open(PROPS / name).convert("RGBA").save(out / name)
        print(f"  decor/lagoon/{name}")


if __name__ == "__main__":
    print("Building lagoon theme art…")
    build_terrain()
    build_backgrounds()
    build_frog()
    build_decor()
    print("Done.")
