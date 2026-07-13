#!/usr/bin/env python3
"""Compose the Itadori (Jujutsu Kaisen, JUS sheet by BelugaBanaple) character.

Source: jjk_itadori_v2_jus_sprite_sheet_full__updated_1_0__by_belugabanaple_dfa943o.png
— a JUS-style sheet on a green (0,128,0) chroma background with labeled rows.
Same pipeline as scripts/build-jinwoo-character.py: frames are auto-split per
row band on empty-column gaps, keyed out, despeckled, scaled nearest-neighbor
and placed on the shared 128x128 cell grid with the feet on Lumio's y=120 line.
The source art already faces RIGHT — no mirroring.

Slot mapping (see the labeled rows on the source sheet):
  idle    Stand 0-3          run     Run 0-7
  dash    Dash 0-1           jump    Jump 1-2 (crouch prep excluded)
  fall    Jump 3-4 (loops)   runjump Jump 1-4 (with the tuck, plays once)
  land    Jump 5 + Stand 0   punch   B-combo 0-3 (the Divergent Fist jab)

Effect sheets (native 1x, centered in the cell — spawned/scaled in-game):
  fx_impact  blue impact explosion, 6 frames ("SPECIAL EFFECTS" blue row;
             the last dissipating ring arrives split in two halves — merged)
  fx_spark   red Black-Flash spark bursts, 4 frames (red "SPECIAL EFFECTS")
  fx_slash   red circular slash swirls, 4 frames (same row, right section)

Outputs to character-itadori/ (imported by src/config/characterAssets.ts).

Run from the repo root:  python3 scripts/build-itadori-character.py
"""

import os
from PIL import Image

SRC = "jjk_itadori_v2_jus_sprite_sheet_full__updated_1_0__by_belugabanaple_dfa943o.png"
OUT = "character-itadori"
CELL = 128
FEET_Y = 120
BG = (0, 128, 0)
BG_TOL = 40
SCALE = 2.0  # stand frame 50px -> 100px, the same on-screen height as Jin-Woo

# Row bands (x0, y0, x1, y1) around each labeled animation row, excluding
# the label text above and neighboring rows/sections.
BANDS = {
    "stand": (0, 391, 260, 441),
    "run": (0, 469, 460, 518),
    "dash": (460, 469, 650, 518),
    "jump": (0, 547, 340, 614),
    "punch": (0, 948, 240, 1002),  # "B:" jab combo
    # Red jagged spark bursts. Bands start below the "SPECIAL EFFECTS" label
    # text; the first two shapes touch (no clean column gap), so they get
    # their own sub-boxes instead of one auto-split band.
    "fx_spark0": (25, 2490, 105, 2587),
    "fx_spark1": (105, 2490, 200, 2587),
    "fx_spark2": (200, 2490, 295, 2587),
    "fx_spark3": (295, 2490, 430, 2587),
    "fx_slash": (440, 2481, 900, 2587),  # red circular slash swirls
    "fx_impact": (0, 2631, 700, 2734),  # blue impact explosion
}
MIN_GAP = 5  # empty columns needed to split two frames
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


def split_frames(band: Image.Image) -> list[Image.Image]:
    """Split a keyed row band into frames on runs of empty columns."""
    band = despeckle(band)
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
    return [f.crop(f.getbbox()) for f in frames]


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
    """Feet-pinned character sheet: lowest pixel on Lumio's y=120 line."""
    sheet = Image.new("RGBA", (CELL * len(frames), CELL), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        scaled = prep(frame)
        sheet.paste(
            scaled,
            (CELL * i + (CELL - scaled.width) // 2, FEET_Y - scaled.height),
            scaled,
        )
    path = os.path.join(OUT, f"{name}.png")
    sheet.save(path)
    print(f"{path}: {len(frames)} frame(s)")


def build_fx_sheet(name: str, frames: list[Image.Image]) -> None:
    """Effect sheet: native 1x resolution, centered in the cell (impact
    effects are anchored on their center in-game, not on a feet line)."""
    sheet = Image.new("RGBA", (CELL * len(frames), CELL), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        sheet.paste(
            frame,
            (
                CELL * i + (CELL - frame.width) // 2,
                (CELL - frame.height) // 2,
            ),
            frame,
        )
    path = os.path.join(OUT, f"{name}.png")
    sheet.save(path)
    print(f"{path}: {len(frames)} frame(s)")


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    rows = extract()

    build_sheet("idle", rows["stand"])
    build_sheet("run", rows["run"])
    build_sheet("dash", rows["dash"])
    # Jump 0 is a grounded crouch wind-up — skipping it makes takeoff snappy.
    build_sheet("jump", rows["jump"][1:3])
    build_sheet("fall", rows["jump"][3:5])
    build_sheet("runjump", rows["jump"][1:5])
    build_sheet("land", [rows["jump"][5], rows["stand"][0]])
    build_sheet("punch", rows["punch"])

    build_fx_sheet(
        "fx_spark",
        [rows[f"fx_spark{i}"][0] for i in range(4)],
    )
    build_fx_sheet("fx_slash", rows["fx_slash"])
    # The last dissipating ring of the blue explosion has a hollow middle, so
    # the column split sees two halves — re-merge them into one frame.
    impact = rows["fx_impact"]
    if len(impact) == 7:
        a, b = impact[5], impact[6]
        merged = Image.new("RGBA", (a.width + 8 + b.width, max(a.height, b.height)))
        merged.paste(a, (0, (merged.height - a.height) // 2), a)
        merged.paste(b, (a.width + 8, (merged.height - b.height) // 2), b)
        impact = impact[:5] + [merged]
    build_fx_sheet("fx_impact", impact)

    # Portrait: a big crisp idle frame on a SQUARE canvas (the home screen
    # sizes portraits by width, so a square keeps the on-screen height right).
    idle = rows["stand"][0]
    scaled = idle.resize((idle.width * 6, idle.height * 6), Image.NEAREST)
    side = scaled.height
    portrait = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    portrait.paste(scaled, ((side - scaled.width) // 2, 0), scaled)
    portrait.save(os.path.join(OUT, "portrait.png"))
    print(f"{OUT}/portrait.png: {portrait.width}x{portrait.height}")


if __name__ == "__main__":
    main()
