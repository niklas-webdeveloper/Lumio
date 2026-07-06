#!/usr/bin/env python3
"""
Build the small ground-scatter decoration props for the Crimson stage (the
Decor system sprinkles these on exposed ground tiles, like the grass tufts on
levels 1-4), themed so the hellscape ground never shows green foliage:

  decor/crimson/rock-a.png, rock-b.png
      Small charred magma boulders with molten cracks — painted in the JJK lava
      palette (the isometric lava blocks don't shrink into readable pebbles).

The Shadow stage deliberately runs no scatter props (the arcane tiles carry the
look on their own), so only the Crimson set is built.

Usage:  python3 scripts/build-themed-decor.py
"""

import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
DECOR = ROOT / "public" / "assets" / "sprites" / "decor"

LAVA = [(120, 20, 8), (210, 60, 12), (255, 120, 20), (255, 205, 80)]


def trim(im: Image.Image) -> Image.Image:
    bb = im.getbbox()
    return im.crop(bb) if bb else im


def magma_rock(seed: int, w: int, h: int) -> Image.Image:
    """A rounded charred boulder with a couple of glowing lava cracks."""
    rng = random.Random(seed)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # lumpy body from a few overlapping dark ellipses
    for _ in range(5):
        ex = rng.uniform(w * 0.15, w * 0.85)
        ey = rng.uniform(h * 0.45, h * 0.9)
        er = rng.uniform(w * 0.22, w * 0.38)
        shade = rng.choice([(26, 22, 20), (34, 29, 26), (20, 17, 16)])
        d.ellipse([ex - er, ey - er, ex + er, ey + er], fill=(*shade, 255))
    d.ellipse([1, h * 0.42, w - 2, h - 1], fill=(30, 26, 23, 255))
    # glowing lava cracks
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dg = ImageDraw.Draw(glow)
    for _ in range(2):
        x = rng.uniform(w * 0.3, w * 0.7)
        pts = [(x, h * 0.55)]
        for k in range(3):
            x += rng.uniform(-4, 4)
            pts.append((x, h * 0.55 + (k + 1) * (h * 0.12)))
        dg.line(pts, fill=(*LAVA[1], 255), width=2)
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(1.6)))
    core = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dc = ImageDraw.Draw(core)
    dc.line([(w * 0.5, h * 0.55), (w * 0.5, h * 0.9)], fill=(*LAVA[3], 220), width=1)
    im.alpha_composite(core)
    # top rim light
    d = ImageDraw.Draw(im)
    d.arc([2, h * 0.42, w - 3, h * 1.2], 200, 340, fill=(70, 62, 56, 255), width=1)
    return trim(im)


def build_crimson() -> None:
    out = DECOR / "crimson"
    out.mkdir(parents=True, exist_ok=True)
    magma_rock(11, 30, 22).save(out / "rock-a.png")
    magma_rock(23, 24, 18).save(out / "rock-b.png")
    print("decor/crimson: rock-a, rock-b (painted magma boulders)")


def main() -> None:
    build_crimson()
    print("Done.")


if __name__ == "__main__":
    main()
