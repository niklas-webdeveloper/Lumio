#!/usr/bin/env python3
"""Compose the Jin-Woo (Solo Leveling, sheet by Soulfire) character sheets.

Source: sung_jin_woo_sprite_sheet___solo_leveling_by_soulfiresprites_dj1zxuy.png
— an irregular sheet on a green chroma background with labeled rows. Frames
are auto-split per row band on empty-column gaps, keyed out, scaled with
nearest-neighbor and placed on the shared 128x128 cell grid with the feet
on Lumio's y=120 line — so the Player physics stays identical. The source art
already faces RIGHT (same convention as Lumio/Fox: the Player only setFlipX's
when facing left), so no mirroring.

Slot mapping (see the labeled rows on the source sheet):
  idle    Stand 0-4        run   Run 0-7 (dash reuses this sheet)
  jump    Jump 0-1 rising  fall  Jump 4-5 (billowing coat, loops)
  runjump Jump 0-3 (with the mid-air tuck flip, plays once)
  land    Get-Hit 5-6 (crouch -> standing up)

Outputs to character-jinwoo/ (imported by src/config/characterAssets.ts).

Run from the repo root:  python3 scripts/build-jinwoo-character.py
"""

import os
from PIL import Image

SRC = "sung_jin_woo_sprite_sheet___solo_leveling_by_soulfiresprites_dj1zxuy.png"
OUT = "character-jinwoo"
CELL = 128
FEET_Y = 120
BG = (34, 177, 76)
BG_TOL = 60  # squared-ish per-channel tolerance for keying the green out

# Row bands (x0, y0, x1, y1) around each labeled animation row, excluding
# the label text above and neighboring rows.
BANDS = {
    "stand": (0, 205, 255, 295),
    "run": (0, 312, 670, 397),
    "jump": (0, 408, 470, 500),
    "gethit": (0, 512, 450, 588),
}
SCALE = 1.5  # tallest used frame 71px -> ~106px, Foxy/Lumio-comparable
MIN_GAP = 4  # empty columns needed to split two frames
MIN_W = 8  # ignore slivers (stray pixels)


def key_out(img: Image.Image) -> Image.Image:
    """Make every green-ish background pixel fully transparent."""
    img = img.convert("RGBA")
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if (
                abs(r - BG[0]) < BG_TOL
                and abs(g - BG[1]) < BG_TOL
                and abs(b - BG[2]) < BG_TOL
            ):
                px[x, y] = (0, 0, 0, 0)
    return img


def split_frames(band: Image.Image) -> list[Image.Image]:
    """Split a keyed row band into frames on runs of empty columns."""
    alpha = band.getchannel("A").load()
    cols = [
        any(alpha[x, y] for y in range(band.height)) for x in range(band.width)
    ]
    frames, start, gap = [], None, 0
    for x, filled in enumerate(cols + [False] * MIN_GAP):
        if filled:
            if start is None:
                start = x
            gap = 0
        elif start is not None:
            gap += 1
            if gap >= MIN_GAP:
                x0, x1 = start, x - gap + 1
                if x1 - x0 >= MIN_W:
                    frames.append(band.crop((x0, 0, x1, band.height)))
                start = None
    return [f.crop(f.getbbox()) for f in map(despeckle, frames)]


def despeckle(img: Image.Image) -> Image.Image:
    """Drop isolated leftover pixels (chroma-key noise) so they can't
    stretch a frame's bbox and shift its feet off the baseline."""
    px = img.load()
    w, h = img.size
    lone = [
        (x, y)
        for y in range(h)
        for x in range(w)
        if px[x, y][3]
        and sum(
            1
            for dx in (-1, 0, 1)
            for dy in (-1, 0, 1)
            if (dx or dy)
            and 0 <= x + dx < w
            and 0 <= y + dy < h
            and px[x + dx, y + dy][3]
        )
        < 2
    ]
    for x, y in lone:
        px[x, y] = (0, 0, 0, 0)
    return img


def extract() -> dict[str, list[Image.Image]]:
    sheet = Image.open(SRC)
    rows = {}
    for name, (x0, y0, x1, y1) in BANDS.items():
        band = key_out(sheet.crop((x0, y0, x1, y1)))
        rows[name] = split_frames(band)
        print(f"{name}: {len(rows[name])} frames, "
              f"sizes {[f.size for f in rows[name]]}")
    return rows


def prep(frame: Image.Image) -> Image.Image:
    """Scale a frame (source already faces right — no mirroring)."""
    return frame.resize(
        (round(frame.width * SCALE), round(frame.height * SCALE)),
        Image.NEAREST,
    )


def build_sheet(name: str, frames: list[Image.Image]) -> None:
    sheet = Image.new("RGBA", (CELL * len(frames), CELL), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        scaled = prep(frame)
        # Frames are bbox-cropped, so the lowest pixel is the feet (or the
        # lowest body point when airborne) — pin it to Lumio's feet line.
        sheet.paste(
            scaled,
            (CELL * i + (CELL - scaled.width) // 2, FEET_Y - scaled.height),
            scaled,
        )
    path = os.path.join(OUT, f"{name}.png")
    sheet.save(path)
    print(f"{path}: {len(frames)} frame(s)")


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    rows = extract()

    build_sheet("idle", rows["stand"])
    build_sheet("run", rows["run"])
    build_sheet("jump", rows["jump"][0:2])
    build_sheet("fall", rows["jump"][4:6])
    build_sheet("runjump", rows["jump"][0:4])
    build_sheet("land", rows["gethit"][5:7])

    # Portrait: a big crisp idle frame on a SQUARE canvas. The home screen
    # sizes portraits by width (.home-hero img { width: 88% }), so a square
    # keeps this tall, slender character the same on-screen height as the
    # roughly-square Lumio/Fox portraits instead of overflowing the box.
    idle = rows["stand"][0]
    scaled = idle.resize((idle.width * 6, idle.height * 6), Image.NEAREST)
    side = scaled.height
    portrait = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    portrait.paste(scaled, ((side - scaled.width) // 2, 0), scaled)
    portrait.save(os.path.join(OUT, "portrait.png"))
    print(f"{OUT}/portrait.png: {portrait.width}x{portrait.height}")


if __name__ == "__main__":
    main()
