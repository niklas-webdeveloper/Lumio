#!/usr/bin/env python3
"""
Generate the parallax background layers for the two anime-styled themes:

  shadow  — "Shadow Monarch" (Solo Leveling): a violet night sky, an arcane
            gate glow, jagged dungeon ridges and gothic spires with glowing
            purple runes and drifting soul-fire particles.
  crimson — "Crimson Shibuya" (JJK Shibuya arc / Sukuna): a blood-red sky
            under a huge malevolent moon, the Shibuya skyline in black-red
            silhouette with burning windows and rising embers.

Output matches the existing hand-painted themes: 5 layers of 1600x800 PNG,
L0 opaque sky, L1..L4 transparent silhouette strips, all seamlessly tileable
horizontally (every shape is periodic in x or drawn wrapped at x +- W).

Usage: python3 scripts/build-anime-backgrounds.py
"""

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

W, H = 1600, 800
OUT = Path(__file__).resolve().parent.parent / "public" / "assets" / "backgrounds"


# ---------- small drawing helpers ----------

def vgrad(stops):
    """Vertical gradient image from [(y_frac, (r,g,b)), ...] stops."""
    im = Image.new("RGB", (W, H))
    px = im.load()
    ys = [s[0] * H for s in stops]
    for y in range(H):
        # find surrounding stops
        for i in range(len(stops) - 1):
            if ys[i] <= y <= ys[i + 1]:
                t = (y - ys[i]) / max(1e-6, ys[i + 1] - ys[i])
                c0, c1 = stops[i][1], stops[i + 1][1]
                c = tuple(int(c0[k] + (c1[k] - c0[k]) * t) for k in range(3))
                break
        else:
            c = stops[-1][1]
        for x in range(0, W, 4):  # write in 4px runs (fast enough, smooth)
            px[x, y] = c
            if x + 1 < W:
                px[x + 1, y] = c
            if x + 2 < W:
                px[x + 2, y] = c
            if x + 3 < W:
                px[x + 3, y] = c
    return im


def periodic_ridge(rng, base, amp, harmonics):
    """A ridge height function periodic over W (sum of integer-frequency sines)."""
    waves = [
        (rng.randint(1, harmonics), rng.uniform(0, 2 * math.pi), rng.uniform(0.4, 1.0))
        for _ in range(4)
    ]
    total_w = sum(w for _, _, w in waves)

    def f(x):
        s = 0.0
        for k, ph, wgt in waves:
            s += wgt * math.sin(2 * math.pi * k * x / W + ph)
        return base + amp * s / total_w

    return f


def fill_ridge(draw, f, color, jag=0, rng=None, step=8):
    """Fill the area below ridge f(x) down to the bottom edge."""
    pts = []
    for x in range(0, W + step, step):
        y = f(x % W)
        if jag and rng:
            y += rng.uniform(-jag, jag)
        pts.append((x, y))
    pts += [(W, H), (0, H)]
    draw.polygon(pts, fill=color)


def wrapped_rect(draw, x, y, w, h, color):
    for ox in (-W, 0, W):
        draw.rectangle([x + ox, y, x + ox + w, y + h], fill=color)


def glow_layer(base, blur, strength=1.0):
    """Return `base` blurred — composite under/over shapes for a glow."""
    g = base.filter(ImageFilter.GaussianBlur(blur))
    if strength != 1.0:
        a = g.getchannel("A").point(lambda v: int(min(255, v * strength)))
        g.putalpha(a)
    return g


def new_layer():
    return Image.new("RGBA", (W, H), (0, 0, 0, 0))


def save(theme, i, im):
    d = OUT / theme
    d.mkdir(parents=True, exist_ok=True)
    im.save(d / f"L{i}.png")
    print(f"  {theme}/L{i}.png")


# ---------- SHADOW (Solo Leveling) ----------

def build_shadow():
    rng = random.Random(51)

    # L0 — night sky: deep indigo to violet horizon, arcane gate glow, stars.
    sky = vgrad([
        (0.00, (10, 8, 26)),
        (0.40, (24, 16, 56)),
        (0.72, (52, 30, 96)),
        (0.90, (88, 52, 140)),
        (1.00, (120, 80, 180)),
    ]).convert("RGBA")
    fx = new_layer()
    d = ImageDraw.Draw(fx)
    # the "gate": a huge violet glow disc low on the horizon
    d.ellipse([W * 0.26, H * 0.42, W * 0.74, H * 1.02], fill=(150, 90, 230, 170))
    d.ellipse([W * 0.36, H * 0.54, W * 0.64, H * 0.94], fill=(200, 140, 255, 190))
    fx = fx.filter(ImageFilter.GaussianBlur(48))
    sky.alpha_composite(fx)
    # a sharp arcane core so the glow reads as a portal, not just haze
    core = new_layer()
    dcore = ImageDraw.Draw(core)
    dcore.ellipse([W * 0.44, H * 0.62, W * 0.56, H * 0.86], fill=(235, 200, 255, 200))
    sky.alpha_composite(core.filter(ImageFilter.GaussianBlur(18)))
    stars = new_layer()
    ds = ImageDraw.Draw(stars)
    for _ in range(240):
        x, y = rng.uniform(0, W), rng.uniform(0, H * 0.62)
        r = rng.uniform(0.5, 1.8)
        a = rng.randint(80, 220)
        ds.ellipse([x - r, y - r, x + r, y + r], fill=(210, 200, 255, a))
    sky.alpha_composite(stars)
    save("shadow", 0, sky)

    # L1 — far jagged dungeon ridge, faint violet haze.
    l1 = new_layer()
    d = ImageDraw.Draw(l1)
    f = periodic_ridge(rng, H * 0.58, H * 0.10, 5)
    fill_ridge(d, f, (44, 30, 82, 235), jag=6, rng=rng)
    haze = new_layer()
    dh = ImageDraw.Draw(haze)
    dh.rectangle([0, H * 0.55, W, H], fill=(120, 80, 200, 46))
    l1.alpha_composite(haze.filter(ImageFilter.GaussianBlur(30)))
    save("shadow", 1, l1)

    # L2 — gothic spires with glowing rune windows.
    l2 = new_layer()
    d = ImageDraw.Draw(l2)
    f = periodic_ridge(rng, H * 0.70, H * 0.05, 3)
    fill_ridge(d, f, (30, 20, 58, 255))
    glow = new_layer()
    dg = ImageDraw.Draw(glow)
    x = 0.0
    while x < W:
        bw = rng.uniform(46, 110)
        bh = rng.uniform(H * 0.10, H * 0.30)
        top = f(x % W) - bh
        wrapped_rect(d, x, top, bw, bh + H, (30, 20, 58, 255))
        # spire tip
        for ox in (-W, 0, W):
            d.polygon([(x + ox, top), (x + ox + bw, top), (x + ox + bw / 2, top - rng.uniform(20, 70))],
                      fill=(30, 20, 58, 255))
        # rune windows
        for _ in range(int(bw * bh / 2600)):
            wx = x + rng.uniform(6, bw - 12)
            wy = top + rng.uniform(10, bh - 10)
            wrapped_rect(dg, wx, wy, 4, 7, (170, 110, 255, 255))
        x += bw + rng.uniform(22, 90)
    l2.alpha_composite(glow_layer(glow, 5, 1.4))
    l2.alpha_composite(glow)
    save("shadow", 2, l2)

    # L3 — closer dark walls / broken arches with violet rim light.
    l3 = new_layer()
    d = ImageDraw.Draw(l3)
    f = periodic_ridge(rng, H * 0.80, H * 0.045, 2)
    rim = new_layer()
    dr = ImageDraw.Draw(rim)
    pts = [(x, f(x % W)) for x in range(0, W + 8, 8)]
    dr.line(pts, fill=(160, 100, 255, 200), width=3)
    fill_ridge(d, f, (20, 13, 40, 255))
    x = 0.0
    while x < W:
        bw = rng.uniform(70, 150)
        bh = rng.uniform(H * 0.06, H * 0.16)
        top = f(x % W) - bh
        wrapped_rect(d, x, top, bw, bh + H, (20, 13, 40, 255))
        for ox in (-W, 0, W):
            dr.line([(x + ox, top), (x + ox + bw, top)], fill=(150, 95, 245, 150), width=2)
        x += bw + rng.uniform(120, 320)
    l3.alpha_composite(glow_layer(rim, 6, 1.2))
    l3.alpha_composite(rim)
    save("shadow", 3, l3)

    # L4 — near spiky crystal/obelisk edge + drifting soul-fire particles.
    l4 = new_layer()
    d = ImageDraw.Draw(l4)
    f = periodic_ridge(rng, H * 0.93, H * 0.03, 3)
    fill_ridge(d, f, (12, 8, 24, 255), jag=4, rng=rng)
    x = 0.0
    while x < W:
        cw = rng.uniform(26, 60)
        ch = rng.uniform(50, 150)
        base_y = f(x % W) + 10
        for ox in (-W, 0, W):
            d.polygon([(x + ox, base_y), (x + ox + cw, base_y), (x + ox + cw * 0.5, base_y - ch)],
                      fill=(16, 10, 32, 255))
        x += cw + rng.uniform(90, 260)
    sparks = new_layer()
    dsp = ImageDraw.Draw(sparks)
    for _ in range(90):
        x, y = rng.uniform(0, W), rng.uniform(H * 0.35, H * 0.95)
        r = rng.uniform(1.2, 3.2)
        dsp.ellipse([x - r, y - r, x + r, y + r], fill=(180, 120, 255, rng.randint(120, 230)))
    l4.alpha_composite(glow_layer(sparks, 4, 1.3))
    l4.alpha_composite(sparks)
    save("shadow", 4, l4)


# ---------- CRIMSON (JJK Shibuya / Sukuna) ----------

def build_crimson():
    rng = random.Random(62)

    # L0 — blood sky with a huge crimson moon and dark cloud bands.
    sky = vgrad([
        (0.00, (26, 2, 8)),
        (0.35, (72, 8, 14)),
        (0.65, (140, 24, 22)),
        (0.85, (190, 52, 30)),
        (1.00, (230, 90, 44)),
    ]).convert("RGBA")
    moon = new_layer()
    dm = ImageDraw.Draw(moon)
    cx, cy, r = W * 0.62, H * 0.34, 150
    dm.ellipse([cx - r * 1.8, cy - r * 1.8, cx + r * 1.8, cy + r * 1.8], fill=(255, 60, 40, 70))
    moon = moon.filter(ImageFilter.GaussianBlur(50))
    dm = ImageDraw.Draw(moon)
    dm.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(248, 90, 60, 255))
    dm.ellipse([cx - r * 0.92, cy - r * 0.92, cx + r * 0.92, cy + r * 0.92], fill=(255, 120, 80, 255))
    # moon craters
    for _ in range(9):
        mx = cx + rng.uniform(-r * 0.6, r * 0.6)
        my = cy + rng.uniform(-r * 0.6, r * 0.6)
        mr = rng.uniform(8, 26)
        dm.ellipse([mx - mr, my - mr, mx + mr, my + mr], fill=(235, 85, 55, 255))
    sky.alpha_composite(moon)
    clouds = new_layer()
    dc = ImageDraw.Draw(clouds)
    for _ in range(14):
        y = rng.uniform(H * 0.05, H * 0.55)
        x0 = rng.uniform(0, W)
        cw = rng.uniform(300, 700)
        ch = rng.uniform(14, 36)
        for ox in (-W, 0, W):
            dc.ellipse([x0 + ox, y, x0 + ox + cw, y + ch], fill=(30, 2, 8, rng.randint(90, 150)))
    sky.alpha_composite(clouds.filter(ImageFilter.GaussianBlur(16)))
    save("crimson", 0, sky)

    # L1 — far Shibuya skyline, dark maroon, sparse lit windows.
    l1 = new_layer()
    d = ImageDraw.Draw(l1)
    base = H * 0.66
    d.rectangle([0, base, W, H], fill=(52, 8, 16, 235))
    glow = new_layer()
    dg = ImageDraw.Draw(glow)
    x = 0.0
    while x < W:
        bw = rng.uniform(50, 130)
        bh = rng.uniform(H * 0.05, H * 0.22)
        wrapped_rect(d, x, base - bh, bw, bh + H, (52, 8, 16, 235))
        for _ in range(int(bw * bh / 3400)):
            wx = x + rng.uniform(5, bw - 10)
            wy = base - bh + rng.uniform(8, bh - 8)
            wrapped_rect(dg, wx, wy, 3, 4, (255, 120, 60, 255))
        x += bw + rng.uniform(6, 46)
    l1.alpha_composite(glow_layer(glow, 3, 1.2))
    l1.alpha_composite(glow)
    save("crimson", 1, l1)

    # L2 — mid skyline with window grids + a shrine torii silhouette.
    l2 = new_layer()
    d = ImageDraw.Draw(l2)
    base = H * 0.78
    d.rectangle([0, base, W, H], fill=(32, 4, 10, 255))
    glow = new_layer()
    dg = ImageDraw.Draw(glow)
    x = 0.0
    while x < W:
        bw = rng.uniform(80, 180)
        bh = rng.uniform(H * 0.10, H * 0.34)
        top = base - bh
        wrapped_rect(d, x, top, bw, bh + H, (32, 4, 10, 255))
        # antenna
        if rng.random() < 0.4:
            ax = x + bw * rng.uniform(0.2, 0.8)
            for ox in (-W, 0, W):
                d.line([(ax + ox, top), (ax + ox, top - rng.uniform(18, 46))], fill=(32, 4, 10, 255), width=3)
        # window grid, partially lit
        cols = int(bw // 14)
        rows = int(bh // 18)
        for ci in range(1, cols):
            for ri in range(1, rows):
                if rng.random() < 0.24:
                    wx = x + ci * 14
                    wy = top + ri * 18
                    wrapped_rect(dg, wx, wy, 5, 7, (255, 90, 50, 255))
        x += bw + rng.uniform(18, 70)
    # torii gate silhouette on the skyline
    tx = W * 0.22
    for ox in (-W, 0, W):
        d.rectangle([tx + ox, base - 120, tx + ox + 14, base], fill=(20, 2, 6, 255))
        d.rectangle([tx + ox + 86, base - 120, tx + ox + 100, base], fill=(20, 2, 6, 255))
        d.rectangle([tx + ox - 14, base - 132, tx + ox + 114, base - 116, ], fill=(20, 2, 6, 255))
        d.rectangle([tx + ox - 4, base - 106, tx + ox + 104, base - 96], fill=(20, 2, 6, 255))
    l2.alpha_composite(glow_layer(glow, 4, 1.3))
    l2.alpha_composite(glow)
    save("crimson", 2, l2)

    # L3 — close rooftops with cursed-energy rim glow.
    l3 = new_layer()
    d = ImageDraw.Draw(l3)
    base = H * 0.88
    rim = new_layer()
    dr = ImageDraw.Draw(rim)
    d.rectangle([0, base, W, H], fill=(16, 2, 6, 255))
    x = 0.0
    while x < W:
        bw = rng.uniform(140, 300)
        bh = rng.uniform(H * 0.05, H * 0.14)
        top = base - bh
        wrapped_rect(d, x, top, bw, bh + H, (16, 2, 6, 255))
        for ox in (-W, 0, W):
            dr.line([(x + ox, top), (x + ox + bw, top)], fill=(255, 60, 40, 170), width=2)
            # rooftop railing posts
            for px_ in range(int(x), int(x + bw), 22):
                d.line([(px_ + ox, top), (px_ + ox, top - 8)], fill=(16, 2, 6, 255), width=2)
        x += bw + rng.uniform(60, 200)
    l3.alpha_composite(glow_layer(rim, 6, 1.1))
    l3.alpha_composite(rim)
    save("crimson", 3, l3)

    # L4 — near black-red foreground edge + rising embers / cursed sparks.
    l4 = new_layer()
    d = ImageDraw.Draw(l4)
    f = periodic_ridge(rng, H * 0.94, H * 0.025, 3)
    fill_ridge(d, f, (8, 1, 3, 255), jag=3, rng=rng)
    # jagged debris spikes
    x = 0.0
    while x < W:
        cw = rng.uniform(20, 52)
        ch = rng.uniform(30, 110)
        base_y = f(x % W) + 10
        for ox in (-W, 0, W):
            d.polygon([(x + ox, base_y), (x + ox + cw, base_y), (x + ox + cw * 0.45, base_y - ch)],
                      fill=(10, 1, 4, 255))
        x += cw + rng.uniform(110, 300)
    embers = new_layer()
    de = ImageDraw.Draw(embers)
    for _ in range(110):
        x, y = rng.uniform(0, W), rng.uniform(H * 0.30, H * 0.97)
        r = rng.uniform(1.0, 3.0)
        col = (255, rng.randint(60, 130), 40, rng.randint(120, 235))
        de.ellipse([x - r, y - r, x + r, y + r], fill=col)
    l4.alpha_composite(glow_layer(embers, 4, 1.4))
    l4.alpha_composite(embers)
    save("crimson", 4, l4)


if __name__ == "__main__":
    print("Building anime theme backgrounds…")
    build_shadow()
    build_crimson()
    print("Done.")
