#!/usr/bin/env python3
"""
Cut the themed enemies for levels 5 & 6 out of the raw concept sheets and pack
them into the sprite strips the game loads:

  sprites/enemies/shadow-soldier.png  2 frames — an armored Shadow-Monarch
      knight brandishing a glowing blade (Solo Leveling sheet, gen-6a57c8fd…).
      Alternated as a slow "march" cadence; the engine adds bob + aura pulse.
  sprites/enemies/lava-golem.png      1 frame — a molten rock golem (JJK sheet,
      gen-0d297e11…). Waddles heavily; engine adds sway + ember pulse.
  sprites/enemies/phoenix.png         18 frames — a fiery phoenix flight cycle
      (JJK phoenix frame set). Soars on a sine bob; wings beat via the strip.

Sources are RGBA with fully transparent backgrounds, so each figure is just a
tight alpha bbox crop, LANCZOS-scaled to its on-screen height and centered on a
uniform, feet-aligned canvas (origin 0.5,1 in-engine).

Usage:  python3 scripts/build-themed-enemies.py
"""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "assets" / "sprites" / "enemies"

SOLDIERS = ROOT / "new_assets" / "solo_leveling" / \
    "gen-6a57c8fd-10c5-44cf-b182-8b3d7c68baf3.png"
GOLEM = ROOT / "new_assets" / "jjk" / \
    "gen-0d297e11-3aef-4066-ae56-7b55a28dd2c1.png"
PHOENIX_DIR = ROOT / "new_assets" / "jjk" / (
    "A-full-body-view-of-a-pixel-art-phoenix-shown-from-max-px-frames-"
    "36-rows-6-cols-6-frames"
)


def trim(im: Image.Image) -> Image.Image:
    bb = im.getbbox()
    return im.crop(bb) if bb else im


def region(sheet: Image.Image, box) -> Image.Image:
    """Crop a rough region then trim to the figure's alpha bbox."""
    return trim(sheet.crop(box))


def scale_to_h(im: Image.Image, h: int) -> Image.Image:
    w = round(im.width * h / im.height)
    return im.resize((w, h), Image.LANCZOS)


def pack_strip(frames: list[Image.Image], path: Path) -> None:
    """Uniform, bottom-centered (feet-aligned) frames packed side by side."""
    cw = max(f.width for f in frames)
    ch = max(f.height for f in frames)
    strip = Image.new("RGBA", (cw * len(frames), ch), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        x = i * cw + (cw - f.width) // 2
        y = ch - f.height  # feet on the bottom edge
        strip.paste(f, (x, y), f)
    OUT.mkdir(parents=True, exist_ok=True)
    strip.save(path)
    print(f"{path.relative_to(ROOT)}: {len(frames)} frame(s), cell {cw}x{ch}")


def build_phoenix() -> None:
    """Pack the 36-frame phoenix flight cycle into one strip. Every frame is
    cropped to the *union* content box of the whole cycle so the bird stays
    registered (no jitter) while the wings flap through the cell. Subsampled to
    18 frames and scaled down for a lean, smooth loop."""
    frames = [
        Image.open(PHOENIX_DIR / f"frame_{i:03d}.png").convert("RGBA")
        for i in range(36)
    ]
    boxes = [f.getbbox() for f in frames]
    l = min(b[0] for b in boxes)
    t = min(b[1] for b in boxes)
    r = max(b[2] for b in boxes)
    b = max(b[3] for b in boxes)
    cropped = [f.crop((l, t, r, b)) for f in frames[::2]]  # 18 frames
    H = 60
    scaled = [scale_to_h(f, H) for f in cropped]
    pack_strip(scaled, OUT / "phoenix.png")


def main() -> None:
    soldiers = Image.open(SOLDIERS).convert("RGBA")
    # Two upright, front-facing knights from the top row: sword lowered, then
    # sword raised — a menacing brandish when alternated. Columns are ~192px.
    knight_a = region(soldiers, (192, 0, 384, 196))   # row0 col1: sword down
    knight_b = region(soldiers, (384, 0, 576, 196))   # row0 col2: sword raised
    # Match heights so the march doesn't bob from frame size alone, then align.
    H = 54
    frames = [scale_to_h(knight_a, H), scale_to_h(knight_b, H)]
    pack_strip(frames, OUT / "shadow-soldier.png")

    golem = trim(Image.open(GOLEM).convert("RGBA"))
    pack_strip([scale_to_h(golem, 62)], OUT / "lava-golem.png")

    build_phoenix()


if __name__ == "__main__":
    main()
