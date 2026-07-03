#!/usr/bin/env python3
"""Compose the in-game world art from the raw SunnyLand pack (new_assets/).

Outputs (committed to public/assets/, loaded by PreloadScene):
  tilesets/terrain.png      extruded 8-tile terrain strip (32px tiles, margin 2, spacing 4)
  sprites/blocks/*.png      lucky / brick / used block sprites (32x32)
  sprites/coin.png          gold-recolored gem spin strip (5 frames)
  sprites/growcap.png       cherry idle strip (7 frames)
  sprites/plodder.png       opossum walk strip (6 frames)
  sprites/snapvine.png      slimer idle strip (8 frames, the pipe lurker)
  sprites/vulture.png       vulture fly strip (4 frames, desert flyer)
  sprites/bat-hang.png      bat hanging/asleep strip (4 frames, graveyard)
  sprites/bat-fly.png       bat fly strip (3 frames, graveyard chaser)
  sprites/icicle.png        ice-graded hanging spikes (falling snow hazard)
  sprites/decor/*.png       non-colliding terrain decoration props

Tile art is pre-scaled 2x (nearest) so a 16px SunnyLand tile fills one 32px
game tile; the 2px extrusion border stops texel bleed at tile seams.
Frame sizes are printed at the end — keep src/config/worldArt.ts in sync.

Run from the repo root:  python3 scripts/build-world-art.py
"""

import colorsys
import os
from PIL import Image

SRC = "new_assets/SunnyLand Artwork"
TILESET = f"{SRC}/Environment/Tileset/tileset-sliced.png"
PROPS = f"{SRC}/Environment/props"
OUT_TILES = "public/assets/tilesets"
OUT_SPRITES = "public/assets/sprites"

CELL = 16  # SunnyLand source tile size
TILE = 32  # game tile size
EXTRUDE = 2  # extrusion border per tile side (Phaser margin 2 / spacing 4)


def cell(sheet: Image.Image, cx: int, cy: int) -> Image.Image:
    """Cut one 16px cell out of the source tileset."""
    return sheet.crop((cx * CELL, cy * CELL, (cx + 1) * CELL, (cy + 1) * CELL))


def x2(im: Image.Image) -> Image.Image:
    return im.resize((im.width * 2, im.height * 2), Image.NEAREST)


def adjust_hsv(im: Image.Image, hue=None, sat_mul=1.0, val_mul=1.0) -> Image.Image:
    """Per-pixel HSV grade (hue is an absolute replacement when given)."""
    im = im.convert("RGBA")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if hue is not None:
                h = hue
            s = min(1.0, s * sat_mul)
            v = min(1.0, v * val_mul)
            r2, g2, b2 = colorsys.hsv_to_rgb(h, s, v)
            px[x, y] = (round(r2 * 255), round(g2 * 255), round(b2 * 255), a)
    return im


# Chunky 7x9 "?" glyph for the lucky block (drawn at 16px scale, doubled later).
QUESTION_MARK = [
    ".XXXXX.",
    "XX...XX",
    "XX...XX",
    "....XX.",
    "...XX..",
    "...XX..",
    ".......",
    "...XX..",
    "...XX..",
]


def draw_glyph(im: Image.Image, ox: int, oy: int, color) -> None:
    px = im.load()
    for gy, row in enumerate(QUESTION_MARK):
        for gx, ch in enumerate(row):
            if ch == "X":
                px[ox + gx, oy + gy] = color


def make_lucky(block: Image.Image) -> Image.Image:
    """Warm-gold graded block with a cream '?' (dark drop shadow)."""
    gold = adjust_hsv(block, hue=0.115, sat_mul=1.25, val_mul=1.15)
    ox = (CELL - 7) // 2  # centered 7px glyph
    oy = (CELL - 9) // 2
    draw_glyph(gold, ox + 1, oy + 1, (74, 42, 18, 255))  # shadow
    draw_glyph(gold, ox, oy, (255, 243, 209, 255))  # glyph
    return gold


def outline(im: Image.Image, color) -> Image.Image:
    """1px dark outline around the opaque silhouette (readability on grass)."""
    im = im.convert("RGBA")
    src = im.load()
    out = im.copy()
    px = out.load()
    for y in range(im.height):
        for x in range(im.width):
            if src[x, y][3] > 0:
                continue
            near = any(
                0 <= x + dx < im.width and 0 <= y + dy < im.height and src[x + dx, y + dy][3] > 0
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
            )
            if near:
                px[x, y] = color
    return out


def make_spike_cell(spikes: Image.Image) -> Image.Image:
    """Bottom-centered, outlined spikes in a transparent 16px cell (hazard)."""
    padded = Image.new("RGBA", (spikes.width + 2, spikes.height + 1), (0, 0, 0, 0))
    padded.paste(spikes, (1, 1), spikes)  # 1px headroom so the outline fits
    spikes = outline(padded, (48, 27, 32, 255))
    out = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    out.paste(spikes, ((CELL - spikes.width) // 2, CELL - spikes.height), spikes)
    return out


def extrude(tile: Image.Image, border: int) -> Image.Image:
    """Repeat a tile's edge pixels `border` px outward (stops seam bleed)."""
    w, h = tile.size
    out = Image.new("RGBA", (w + border * 2, h + border * 2), (0, 0, 0, 0))
    out.paste(tile, (border, border))
    for i in range(border):
        out.paste(tile.crop((0, 0, w, 1)), (border, i))  # top edge
        out.paste(tile.crop((0, h - 1, w, h)), (border, h + border + i))  # bottom
    for i in range(border):
        col = out.crop((border, 0, border + 1, h + border * 2))
        out.paste(col, (i, 0))  # left (incl. corners)
        col = out.crop((w + border - 1, 0, w + border, h + border * 2))
        out.paste(col, (w + border + i, 0))  # right
    return out


def strip(frames: list[Image.Image]) -> Image.Image:
    """Pack equally-sized frames into one horizontal spritesheet strip."""
    w, h = frames[0].size
    assert all(f.size == (w, h) for f in frames), "frames must be uniform"
    out = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        out.paste(f, (i * w, 0), f)
    return out


def crop_union(frames: list[Image.Image]) -> list[Image.Image]:
    """Crop all frames to the union of their content boxes (keeps registration)."""
    boxes = [f.getbbox() for f in frames]
    l = min(b[0] for b in boxes)
    t = min(b[1] for b in boxes)
    r = max(b[2] for b in boxes)
    b_ = max(b[3] for b in boxes)
    return [f.crop((l, t, r, b_)) for f in frames]


def gold_gem(im: Image.Image) -> Image.Image:
    return adjust_hsv(im, hue=0.125, sat_mul=1.05)


def main() -> None:
    os.makedirs(OUT_TILES, exist_ok=True)
    os.makedirs(f"{OUT_SPRITES}/blocks", exist_ok=True)
    os.makedirs(f"{OUT_SPRITES}/decor", exist_ok=True)

    sheet = Image.open(TILESET).convert("RGBA")
    block = Image.open(f"{PROPS}/block.png").convert("RGBA")
    crate = Image.open(f"{PROPS}/crate.png").convert("RGBA")
    spikes = Image.open(f"{PROPS}/spikes.png").convert("RGBA")

    # --- Terrain tileset, GID order must match src/config/Tiles.ts ---
    tiles16 = [
        cell(sheet, 1, 1),        # 1 GrassTop: grass-topped ground (center)
        cell(sheet, 1, 3),        # 2 Dirt: plain soil fill
        cell(sheet, 17, 14),      # 3 Stone: floating grass island platform
        crate,                    # 4 Brick: breakable wooden crate
        make_lucky(block),        # 5 Lucky: gold block with "?"
        adjust_hsv(block, sat_mul=0.9, val_mul=0.7),  # 6 Used: spent block
        make_spike_cell(spikes),  # 7 Spike: hazard
        cell(sheet, 10, 1),       # 8 Plate: wooden log walkway
        # 9 Quicksand: sandy sink-pit surface (desert; non-solid, special-cased)
        adjust_hsv(cell(sheet, 1, 1), hue=0.105, sat_mul=0.9, val_mul=1.12),
        # 10 Ice: slippery frozen ground (snow; solid, low-grip)
        adjust_hsv(cell(sheet, 1, 1), hue=0.55, sat_mul=0.42, val_mul=1.32),
    ]
    tiles32 = [x2(t) for t in tiles16]
    padded = TILE + EXTRUDE * 2
    tileset = Image.new("RGBA", (padded * len(tiles32), padded), (0, 0, 0, 0))
    for i, t in enumerate(tiles32):
        tileset.paste(extrude(t, EXTRUDE), (i * padded, 0))
    tileset.save(f"{OUT_TILES}/terrain.png")
    print(f"tileset: {tileset.size}, tile {TILE}, margin {EXTRUDE}, spacing {EXTRUDE * 2}")

    # --- Standalone block sprites (same art as the tiles) ---
    for name, im in [("lucky", tiles32[4]), ("brick", tiles32[3]), ("used", tiles32[5])]:
        im.save(f"{OUT_SPRITES}/blocks/{name}.png")

    # --- Animated sprite strips ---
    def frames_of(pattern: str, count: int) -> list[Image.Image]:
        return [Image.open(pattern.format(i)).convert("RGBA") for i in range(1, count + 1)]

    coin = [x2(gold_gem(f)) for f in crop_union(frames_of(f"{SRC}/Sprites/Items/gem/gem-{{}}.png", 5))]
    strip(coin).save(f"{OUT_SPRITES}/coin.png")
    print(f"coin: {len(coin)} frames of {coin[0].size}")

    cherry = crop_union(frames_of(f"{SRC}/Sprites/Items/cherry/cherry-{{}}.png", 7))
    strip(cherry).save(f"{OUT_SPRITES}/growcap.png")
    print(f"growcap: {len(cherry)} frames of {cherry[0].size}")

    opossum = crop_union(frames_of(f"{SRC}/Sprites/Enemies/opossum/opossum-{{}}.png", 6))
    strip(opossum).save(f"{OUT_SPRITES}/plodder.png")
    print(f"plodder: {len(opossum)} frames of {opossum[0].size}")

    slimer = crop_union(frames_of(f"{SRC}/Sprites/Enemies/Slimer-Idle/slimer-idle{{}}.png", 8))
    strip(slimer).save(f"{OUT_SPRITES}/snapvine.png")
    print(f"snapvine (slimer): {len(slimer)} frames of {slimer[0].size}")

    vulture = crop_union(frames_of(f"{SRC}/Sprites/Enemies/Vulture/vulture{{}}.png", 4))
    strip(vulture).save(f"{OUT_SPRITES}/vulture.png")
    print(f"vulture: {len(vulture)} frames of {vulture[0].size}")

    bat_hang = crop_union(frames_of(f"{SRC}/Sprites/Enemies/bat/bat-hang/bat-hang{{}}.png", 4))
    strip(bat_hang).save(f"{OUT_SPRITES}/bat-hang.png")
    print(f"bat-hang: {len(bat_hang)} frames of {bat_hang[0].size}")

    bat_fly = crop_union(frames_of(f"{SRC}/Sprites/Enemies/bat/bat-fly/bat-fly{{}}.png", 3))
    strip(bat_fly).save(f"{OUT_SPRITES}/bat-fly.png")
    print(f"bat-fly: {len(bat_fly)} frames of {bat_fly[0].size}")

    # Icicle: the hanging ceiling spikes, ice-graded and doubled to game scale.
    spikes_top = Image.open(f"{PROPS}/spikes-top.png").convert("RGBA")
    icicle = x2(adjust_hsv(spikes_top, hue=0.55, sat_mul=0.5, val_mul=1.35))
    icicle.save(f"{OUT_SPRITES}/icicle.png")
    print(f"icicle: {icicle.size}")

    # --- Decoration props (cropped tight, placed on grass by Decor system) ---
    decor: dict[str, Image.Image] = {
        "tuft-a": cell(sheet, 1, 7),
        "tuft-b": cell(sheet, 3, 7),
        "shrooms": Image.open(f"{PROPS}/shrooms.png").convert("RGBA"),
        "bush": Image.open(f"{PROPS}/bush.png").convert("RGBA"),
        "rock": Image.open(f"{PROPS}/rock.png").convert("RGBA"),
    }
    for name, im in decor.items():
        im = im.crop(im.getbbox())
        im.save(f"{OUT_SPRITES}/decor/{name}.png")
        print(f"decor/{name}: {im.size}")


if __name__ == "__main__":
    main()
