#!/usr/bin/env python3
"""
Build per-theme terrain tilesets for the two anime stages, so levels 5 & 6 no
longer share the green SunnyLand terrain but get their own material:

  terrain-shadow.png   Solo Leveling look — dark arcane stone with glowing cyan
                       runes, cropped straight from the rune tile atlas
                       (new_assets/solo_leveling/gen-9fd74f3f…, a real flat
                       6x6 tile sheet).
  terrain-crimson.png  JJK / Sukuna look — charred basalt cobbles veined with
                       molten lava, painted in the palette of the isometric
                       lava blocks (new_assets/jjk/…, which are used as decor
                       props instead — they don't crop into flat tiles).

Both strips match public/assets/tilesets/terrain.png exactly: 10 tiles in GID
order (see src/config/Tiles.ts), 32px tiles, 2px extrusion (Phaser margin 2 /
spacing 4). Only GrassTop/Dirt/Stone/Spike/Plate actually show up in the L5/L6
terrain layers; the rest are filled with a plain themed stone for completeness.

Usage:  python3 scripts/build-themed-tiles.py
"""

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT_TILES = ROOT / "public" / "assets" / "tilesets"
SHADOW_ATLAS = ROOT / "new_assets" / "solo_leveling" / \
    "gen-9fd74f3f-b66d-4084-9938-4f5a8d64f99b.png"

TILE = 32
EXTRUDE = 2
ATLAS_CELL = 128


# ---------- shared helpers (mirrors build-world-art.py) ----------

def extrude(tile: Image.Image, border: int) -> Image.Image:
    """Repeat a tile's edge pixels `border` px outward (stops seam bleed)."""
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


def pack(tiles32: list[Image.Image], path: Path) -> None:
    padded = TILE + EXTRUDE * 2
    strip = Image.new("RGBA", (padded * len(tiles32), padded), (0, 0, 0, 0))
    for i, t in enumerate(tiles32):
        strip.paste(extrude(t.convert("RGBA"), EXTRUDE), (i * padded, 0))
    strip.save(path)
    print(f"{path.relative_to(ROOT)}: {strip.size} "
          f"(tile {TILE}, margin {EXTRUDE}, spacing {EXTRUDE*2})")


def lerp(a, b, t):
    return tuple(round(a[k] + (b[k] - a[k]) * t) for k in range(len(a)))


# ---------- SHADOW: crop the real rune-stone atlas ----------

def interior(cell_rc, size=80) -> Image.Image:
    """Crop the solid interior square of an atlas cell (avoids the soft, glowy
    cell edges) and scale to a 32px tile. Interior stone tiles seamlessly."""
    r, c = cell_rc
    sheet = Image.open(SHADOW_ATLAS).convert("RGBA")
    cell = sheet.crop((c * ATLAS_CELL, r * ATLAS_CELL,
                       (c + 1) * ATLAS_CELL, (r + 1) * ATLAS_CELL))
    off = (ATLAS_CELL - size) // 2
    body = cell.crop((off, off, off + size, off + size))
    tile = body.resize((TILE, TILE), Image.LANCZOS)
    # Force full opacity — interior stone has no real holes, and any soft
    # sampling on the border must not let the parallax bg peek through.
    a = tile.getchannel("A").point(lambda v: 255)
    tile.putalpha(a)
    return tile


def add_top_crest(tile: Image.Image, glow=(90, 210, 255)) -> Image.Image:
    """Paint a glowing cyan surface line + rune ticks along the tile top so a
    ground surface reads distinctly from the fill below it."""
    t = tile.copy()
    d = ImageDraw.Draw(t)
    # soft dark lip then the bright rune line
    d.rectangle([0, 0, TILE, 1], fill=(8, 16, 34, 255))
    glowline = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
    dg = ImageDraw.Draw(glowline)
    dg.rectangle([0, 2, TILE, 4], fill=(*glow, 255))
    for x in (5, 15, 25):  # little rune ticks hanging down
        dg.rectangle([x, 2, x + 2, 8], fill=(*glow, 255))
    blur = glowline.filter(ImageFilter.GaussianBlur(1.4))
    t.alpha_composite(blur)
    t.alpha_composite(glowline)
    return t


def shadow_spike() -> Image.Image:
    """Upward blue crystal shards, hot cyan cores, transparent bg (hazard)."""
    t = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(t)
    dark, mid, core = (14, 30, 66), (40, 120, 210), (150, 235, 255)
    base = TILE - 3
    shards = [(6, 10), (16, 3), (26, 11)]  # (tip_x, tip_y)
    for tx, ty in shards:
        d.polygon([(tx - 5, base), (tx + 5, base), (tx, ty)], fill=(*dark, 255))
        d.polygon([(tx - 3, base), (tx + 3, base), (tx, ty + 2)], fill=(*mid, 255))
        d.line([(tx, base), (tx, ty + 3)], fill=(*core, 255), width=1)
    d.rectangle([0, base, TILE, TILE], fill=(20, 40, 80, 255))  # mount
    glow = t.filter(ImageFilter.GaussianBlur(2))
    out = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
    out.alpha_composite(glow)
    out.alpha_composite(t)
    return out


def build_shadow() -> list[Image.Image]:
    fill = interior((0, 0))          # plain cracked arcane stone
    rune = interior((0, 1))          # glowing rune-star block
    rune2 = interior((0, 4))         # glowing rune-star block (variant)
    surface = add_top_crest(fill)    # dark stone + glowing cyan crest
    return [
        surface,          # 1 GrassTop
        fill,             # 2 Dirt
        rune,             # 3 Stone (glowing platform block)
        rune2,            # 4 Brick (unused in terrain)
        rune,             # 5 Lucky (unused in terrain)
        fill,             # 6 Used  (unused in terrain)
        shadow_spike(),   # 7 Spike
        rune2,            # 8 Plate (glowing floating step)
        fill,             # 9 Quicksand (unused)
        fill,             # 10 Ice (unused)
    ]


# ---------- CRIMSON: painted charred basalt + lava veins ----------

CRIM_DARK = [(18, 16, 16), (28, 24, 22), (40, 34, 30), (52, 44, 38)]
LAVA = [(120, 20, 8), (210, 60, 12), (255, 120, 20), (255, 200, 70)]


def cobbles(rng, veins: float, hot: bool) -> Image.Image:
    """A seamless 32px charred-cobble tile. `veins` in [0,1] = how much molten
    lava glows in the cracks between stones; `hot` brightens the whole thing."""
    t = Image.new("RGBA", (TILE, TILE), (10, 8, 8, 255))
    d = ImageDraw.Draw(t)
    step = 8
    # jittered stone grid; wrap-draw so left/right & top/bottom edges match.
    for gy in range(0, TILE, step):
        for gx in range(0, TILE, step):
            jx = rng.randint(-1, 1)
            jy = rng.randint(-1, 1)
            base = CRIM_DARK[rng.randint(0, len(CRIM_DARK) - 1)]
            for ox in (-TILE, 0, TILE):
                for oy in (-TILE, 0, TILE):
                    x0, y0 = gx + jx + ox + 1, gy + jy + oy + 1
                    x1, y1 = gx + ox + step - 1, gy + oy + step - 1
                    d.rounded_rectangle([x0, y0, x1, y1], radius=2,
                                        fill=(*base, 255))
                    d.line([x0, y0, x1 - 2, y0], fill=lerp(base, (90, 84, 78), .6))
                    d.line([x0, y0, x0, y1 - 2], fill=lerp(base, (80, 74, 68), .5))
                    d.line([x0 + 2, y1, x1, y1], fill=(8, 6, 6))
    if veins > 0:
        glow = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
        dg = ImageDraw.Draw(glow)
        # lava runs along the cobble seams (the grid lines), periodic => seamless
        for gy in range(0, TILE + 1, step):
            if rng.random() < veins:
                for ox in (-2, 0):
                    dg.line([0, gy + ox, TILE, gy + ox],
                            fill=(*LAVA[1], 255), width=2)
        for gx in range(0, TILE + 1, step):
            if rng.random() < veins * 0.8:
                dg.line([gx, 0, gx, TILE], fill=(*LAVA[1], 255), width=2)
        blur = glow.filter(ImageFilter.GaussianBlur(2))
        if hot:
            blur = Image.eval(blur, lambda v: min(255, int(v * 1.3)))
        t.alpha_composite(blur)
        # bright molten cores on top of the glow
        core = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
        dc = ImageDraw.Draw(core)
        for gy in range(0, TILE + 1, step):
            if rng.random() < veins:
                dc.line([0, gy - 1, TILE, gy - 1], fill=(*LAVA[3], 230), width=1)
        t.alpha_composite(core)
    a = t.getchannel("A").point(lambda v: 255)
    t.putalpha(a)
    return t


def crimson_surface(rng) -> Image.Image:
    """Basalt with a molten crust glowing along the top edge (ground surface)."""
    t = cobbles(rng, veins=0.15, hot=False)
    crust = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
    dc = ImageDraw.Draw(crust)
    for x in range(0, TILE):
        y = 2 + int(1.5 * math.sin(x / 3.0))
        dc.line([x, 0, x, y + 3], fill=(*LAVA[2], 255))
        dc.point((x, y + 3), fill=(*LAVA[3], 255))
    glow = crust.filter(ImageFilter.GaussianBlur(2))
    out = t.copy()
    out.alpha_composite(glow)
    out.alpha_composite(crust)
    d = ImageDraw.Draw(out)
    d.rectangle([0, 0, TILE, 0], fill=(*LAVA[3], 255))
    return out


def crimson_spike() -> Image.Image:
    """Upward obsidian shards with molten hot tips, transparent bg (hazard)."""
    t = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(t)
    base = TILE - 3
    for tx, ty in [(6, 9), (16, 2), (26, 10)]:
        d.polygon([(tx - 5, base), (tx + 5, base), (tx, ty)], fill=(20, 16, 16, 255))
        d.polygon([(tx - 2, base), (tx + 2, base), (tx, ty + 5)], fill=(*LAVA[1], 255))
        d.line([(tx, ty + 7), (tx, ty)], fill=(*LAVA[3], 255), width=1)
    d.rectangle([0, base, TILE, TILE], fill=(24, 18, 16, 255))
    glow = t.filter(ImageFilter.GaussianBlur(2))
    out = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
    out.alpha_composite(glow)
    out.alpha_composite(t)
    return out


def build_crimson() -> list[Image.Image]:
    rng = random.Random(714)
    fill = cobbles(random.Random(1), veins=0.0, hot=False)     # dark basalt
    magma = cobbles(random.Random(2), veins=0.55, hot=True)    # veined block
    obsid = cobbles(random.Random(3), veins=0.08, hot=False)   # near-black plate
    surface = crimson_surface(random.Random(4))
    return [
        surface,           # 1 GrassTop
        fill,              # 2 Dirt
        magma,             # 3 Stone (molten platform block)
        magma,             # 4 Brick (unused)
        magma,             # 5 Lucky (unused)
        fill,              # 6 Used (unused)
        crimson_spike(),   # 7 Spike
        obsid,             # 8 Plate (obsidian floating step)
        fill,              # 9 Quicksand (unused)
        fill,              # 10 Ice (unused)
    ]


def main() -> None:
    OUT_TILES.mkdir(parents=True, exist_ok=True)
    print("Building themed terrain tilesets…")
    pack(build_shadow(), OUT_TILES / "terrain-shadow.png")
    pack(build_crimson(), OUT_TILES / "terrain-crimson.png")
    print("Done.")


if __name__ == "__main__":
    main()
