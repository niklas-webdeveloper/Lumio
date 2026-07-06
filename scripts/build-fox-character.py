#!/usr/bin/env python3
"""Compose the Fenna (SunnyLand fox) character sheets from new_assets/.

Outputs (committed to character-fox/, imported by src/config/characterAssets.ts):
  idle.png      4 frames   run.png      6 frames   jump.png     1 frame
  fall.png      1 frame    land.png     2 frames (crouch pose)
  runjump.png   2 frames (jump + fall pose)
  climb.png     3 frames (flag-pole slide pose)
  portrait.png  single 8x idle frame (home screen / shop card)

Every sheet uses the same 128x128 cell layout as Lumio's sheets, so the
Player entity can drive both characters with identical physics tuning:
the 33x32 source frames are scaled 3x (nearest) and placed with the fox's
feet on Lumio's y=120 feet line, horizontally centered.

Run from the repo root:  python3 scripts/build-fox-character.py
"""

import os
from PIL import Image

SRC = "new_assets/SunnyLand Artwork/Sprites/player"
OUT = "character-fox"
CELL = 128  # Lumio sheet cell size (see src/config/characterAssets.ts)
SCALE = 3  # 33x32 source -> 99x96, fits the cell with room for the feet line
FEET_Y = 120  # Lumio's feet line inside the 128px cell


def load(rel: str) -> Image.Image:
    # SunnyLand frames natively face right — same convention as Lumio
    # (the Player flips via setFlipX only when facing left), so no mirroring.
    return Image.open(os.path.join(SRC, rel)).convert("RGBA")


def baseline(img: Image.Image) -> int:
    """Lowest row containing a visible pixel (the character's feet)."""
    alpha = img.getchannel("A")
    w, h = img.size
    data = alpha.load()
    for y in range(h - 1, -1, -1):
        if any(data[x, y] for x in range(w)):
            return y
    raise ValueError("empty frame")


def build_sheet(name: str, frames: list[Image.Image], offset_y: int) -> None:
    sheet = Image.new("RGBA", (CELL * len(frames), CELL), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        scaled = frame.resize(
            (frame.width * SCALE, frame.height * SCALE), Image.NEAREST
        )
        offset_x = (CELL - scaled.width) // 2
        sheet.paste(scaled, (CELL * i + offset_x, offset_y), scaled)
    path = os.path.join(OUT, f"{name}.png")
    sheet.save(path)
    print(f"{path}: {len(frames)} frame(s) @ {CELL}x{CELL}")


def main() -> None:
    os.makedirs(OUT, exist_ok=True)

    idle = [load(f"idle/player-idle-{i}.png") for i in range(1, 5)]
    run = [load(f"run/player-run-{i}.png") for i in range(1, 7)]
    jump = [load("jump/player-jump-1.png")]
    fall = [load("jump/player-fall.png")]
    crouch = [load(f"crouch/player-crouch-{i}.png") for i in range(1, 3)]
    climb = [load(f"climb/player-climb-{i}.png") for i in range(1, 4)]

    # One shared vertical offset (from the idle stance) keeps the artist's
    # relative frame alignment intact across all animations.
    offset_y = FEET_Y - (baseline(idle[0]) + 1) * SCALE
    print(f"idle baseline row {baseline(idle[0])} -> offset_y {offset_y}")

    build_sheet("idle", idle, offset_y)
    build_sheet("run", run, offset_y)
    build_sheet("jump", jump, offset_y)
    build_sheet("fall", fall, offset_y)
    build_sheet("land", crouch, offset_y)
    build_sheet("runjump", jump + fall, offset_y)
    build_sheet("climb", climb, offset_y)

    # Portrait: a big crisp idle frame for the home screen and the shop card.
    portrait = idle[0].resize((idle[0].width * 8, idle[0].height * 8), Image.NEAREST)
    portrait.save(os.path.join(OUT, "portrait.png"))
    print(f"{OUT}/portrait.png: {portrait.width}x{portrait.height}")


if __name__ == "__main__":
    main()
