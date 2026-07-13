#!/usr/bin/env python3
"""
Build the boss art for the two boss stages:

  sprites/bosses/monarch.png       3 frames — the SHADOW MONARCH (level-08
      "Monarchs Thron"): the big armored knight from the Solo Leveling sheet
      (gen-6a57c8fd…, same source as the shadow-soldier), scaled to boss size.
      Frames: 0 idle (sword shouldered), 1 brandish low, 2 brandish raised.
  sprites/bosses/shadow-beast.png  2 frames — the Monarch's summoned minion:
      the black shadow creature from the same sheet (claws up / crouched).
  sprites/bosses/kraken.png        4 frames — the KRAKEN (level-09
      "Krakenbucht"): hand-drawn cartoon pixel art in the SunnyLand palette.
      Frames: 0/1 idle bob (tentacle sway), 2 attack (mouth open, tentacles
      up), 3 stunned (X-eyes, slumped — the vulnerable window).
  sprites/bosses/tentacle.png      2 frames — a rising tentacle hazard column
      (wave alternates per frame).
  sprites/bosses/shadow-orb.png    1 frame  — the Monarch's shadow bolt.
  sprites/bosses/ink-orb.png       1 frame  — the Kraken's lobbed ink blob.

Deterministic; just re-run after tweaks:  python3 scripts/build-boss-art.py
"""

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "assets" / "sprites" / "bosses"
SHEET = ROOT / "new_assets" / "solo_leveling" / \
    "gen-6a57c8fd-10c5-44cf-b182-8b3d7c68baf3.png"


# ---------- shared helpers (same conventions as build-themed-enemies.py) ----

def trim(im: Image.Image) -> Image.Image:
    bb = im.getbbox()
    return im.crop(bb) if bb else im


def region(sheet: Image.Image, box) -> Image.Image:
    return trim(sheet.crop(box))


def scale_to_h(im: Image.Image, h: int) -> Image.Image:
    w = round(im.width * h / im.height)
    return im.resize((w, h), Image.LANCZOS)


def pack_strip(frames, path: Path) -> None:
    """Uniform, bottom-centered (feet-aligned) frames packed side by side."""
    cw = max(f.width for f in frames)
    ch = max(f.height for f in frames)
    strip = Image.new("RGBA", (cw * len(frames), ch), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        x = i * cw + (cw - f.width) // 2
        y = ch - f.height
        strip.paste(f, (x, y), f)
    OUT.mkdir(parents=True, exist_ok=True)
    strip.save(path)
    print(f"{path.relative_to(ROOT)}: {len(frames)} frame(s), cell {cw}x{ch}")


# ---------- Shadow Monarch + his summoned beasts (from the SL sheet) --------

def build_monarch() -> None:
    sheet = Image.open(SHEET).convert("RGBA")
    # Top row: col0 knight w/ shouldered sword (idle), col1 sword low,
    # col2 sword raised — the same figures the 54px soldier was cut from,
    # here scaled to an imposing boss height.
    idle = region(sheet, (0, 0, 192, 196))
    low = region(sheet, (192, 0, 384, 196))
    raised = region(sheet, (384, 0, 576, 196))
    H = 126
    pack_strip([scale_to_h(f, H) for f in (idle, low, raised)],
               OUT / "monarch.png")


def build_shadow_beast() -> None:
    sheet = Image.open(SHEET).convert("RGBA")
    # Second row: the black shadow creatures (claws raised / crouched lunge).
    claws = region(sheet, (0, 196, 192, 392))
    crouch = region(sheet, (192, 196, 384, 392))
    H = 44
    pack_strip([scale_to_h(f, H) for f in (claws, crouch)],
               OUT / "shadow-beast.png")


# ---------- Kraken (hand-drawn cartoon pixel art) ---------------------------

# SunnyLand-adjacent palette: deep sea purple body, pale belly, coral accents.
K_OUT = (24, 14, 38)          # outline
K_BODY = (106, 62, 140)       # dome
K_BODY_HI = (140, 92, 178)    # dome highlight
K_BODY_LO = (78, 42, 108)     # dome shade
K_BELLY = (226, 190, 214)     # belly / underside
K_SPOT = (156, 108, 192)      # dome spots
K_EYE_W = (250, 248, 240)
K_EYE_P = (30, 20, 40)
K_MOUTH = (52, 22, 48)
K_TEETH = (250, 248, 240)
K_SUCKER = (238, 150, 160)    # tentacle suckers


def px(d: ImageDraw.ImageDraw, x: int, y: int, c) -> None:
    d.point((x, y), fill=c)


def blob(d, x0, y0, x1, y1, fill, outline=None):
    d.ellipse((x0, y0, x1, y1), fill=fill, outline=outline)


def draw_tentacle(d, x, y_top, y_bot, phase, width=3, amp=3.2):
    """One wavy tentacle column with suckers; phase flips the wave. The limb
    tapers toward the tip and the wave grows with distance from the body."""
    import math
    span = max(1, y_bot - y_top)
    for y in range(y_top, y_bot + 1):
        t = (y - y_top) / span
        dx = round(math.sin(t * 4.6 + phase) * amp * t)
        w = max(2, round(width * (1.0 - 0.45 * t)))  # taper toward the tip
        x0 = x + dx - w // 2
        for xx in range(x0, x0 + w):
            d.point((xx, y), fill=K_BODY)
        d.point((x0 - 1, y), fill=K_OUT)
        d.point((x0 + w, y), fill=K_OUT)
        if y % 4 == 2:
            d.point((x + dx, y), fill=K_SUCKER)
    # rounded tip, curling with the wave's end
    dxe = round(math.sin(4.6 + phase) * amp)
    d.ellipse((x + dxe - 2, y_bot - 1, x + dxe + 2, y_bot + 2), fill=K_BODY, outline=K_OUT)


def draw_kraken_frame(mode: str, wob: int) -> Image.Image:
    """One 56x48 kraken. mode: 'idle' | 'attack' | 'stun'; wob 0/1 sways art."""
    W, H = 56, 48
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx = W // 2
    top = 4 + wob  # idle bob
    dome_bot = 30 + (2 if mode == "stun" else 0)  # stunned: slumped lower

    # Tentacles behind the dome (4, alternating wave phase).
    for i, tx in enumerate((cx - 18, cx - 8, cx + 8, cx + 18)):
        ph = (i % 2) * 3.14 + wob * 1.5
        y0 = dome_bot - 6
        y1 = H - 3 - (6 if mode == "attack" and i in (0, 3) else 0)
        if mode == "attack" and i in (0, 3):
            # outer tentacles rear up during the attack
            y0 -= 10
        draw_tentacle(d, tx, y0, y1, ph)

    # Dome (head/mantle).
    blob(d, cx - 17, top, cx + 17, dome_bot, K_BODY, K_OUT)
    blob(d, cx - 13, top + 2, cx + 6, top + 12, K_BODY_HI)  # sheen
    blob(d, cx - 15, dome_bot - 9, cx + 15, dome_bot - 1, K_BODY_LO)
    # belly plate
    blob(d, cx - 12, dome_bot - 8, cx + 12, dome_bot + 1, K_BELLY, K_OUT)
    # spots
    for sx, sy in ((cx - 12, top + 9), (cx + 9, top + 6), (cx + 13, top + 13)):
        blob(d, sx, sy, sx + 2, sy + 2, K_SPOT)

    # Face.
    eye_y = top + 10
    if mode == "stun":
        # X-eyes + lolling tongue
        for ex in (cx - 9, cx + 5):
            d.line((ex, eye_y, ex + 4, eye_y + 4), fill=K_EYE_P, width=1)
            d.line((ex + 4, eye_y, ex, eye_y + 4), fill=K_EYE_P, width=1)
        d.rectangle((cx - 2, dome_bot - 6, cx + 2, dome_bot - 3), fill=K_MOUTH)
        d.rectangle((cx - 1, dome_bot - 3, cx + 1, dome_bot), fill=K_SUCKER)
    else:
        for ex in (cx - 10, cx + 4):
            blob(d, ex, eye_y, ex + 6, eye_y + 7, K_EYE_W, K_OUT)
            pup = 1 if wob else 2
            blob(d, ex + pup + 1, eye_y + 3, ex + pup + 3, eye_y + 5, K_EYE_P)
        # angry brows
        d.line((cx - 11, eye_y - 2, cx - 4, eye_y + 1), fill=K_OUT, width=2)
        d.line((cx + 11, eye_y - 2, cx + 4, eye_y + 1), fill=K_OUT, width=2)
        if mode == "attack":
            # open mouth with teeth
            d.ellipse((cx - 6, dome_bot - 9, cx + 6, dome_bot - 1), fill=K_MOUTH, outline=K_OUT)
            for tx in (cx - 4, cx, cx + 4):
                d.polygon([(tx, dome_bot - 9), (tx + 2, dome_bot - 9), (tx + 1, dome_bot - 6)], fill=K_TEETH)
        else:
            d.arc((cx - 5, dome_bot - 10, cx + 5, dome_bot - 3), 20, 160, fill=K_OUT, width=1)

    im = im.resize((W * 3, H * 3), Image.NEAREST)
    if mode == "stun":
        # pale the stunned frame slightly so the window reads at a glance
        overlay = Image.new("RGBA", im.size, (255, 255, 255, 46))
        im = Image.alpha_composite(im, overlay)
    return trim(im)


def build_kraken() -> None:
    frames = [
        draw_kraken_frame("idle", 0),
        draw_kraken_frame("idle", 1),
        draw_kraken_frame("attack", 0),
        draw_kraken_frame("stun", 0),
    ]
    pack_strip(frames, OUT / "kraken.png")


def build_tentacle() -> None:
    """Standalone rising-tentacle hazard (26x104 per frame, 2 wave frames)."""
    frames = []
    for phase in (0.0, 3.14):
        im = Image.new("RGBA", (26, 104), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        draw_tentacle(d, 13, 6, 100, phase, width=7, amp=4.5)
        # the hazard rises out of the ground: root thick at the BOTTOM,
        # tapered wave upward — so flip, then cap it with a curled tip.
        im = im.transpose(Image.FLIP_TOP_BOTTOM)
        d = ImageDraw.Draw(im)
        blob(d, 6, 0, 20, 12, K_BODY, K_OUT)
        blob(d, 9, 3, 13, 7, K_SUCKER)
        frames.append(im.resize((26 * 2, 104 * 2), Image.NEAREST))
    pack_strip(frames, OUT / "tentacle.png")


# ---------- Projectiles ------------------------------------------------------

def radial_orb(size: int, core, glow) -> Image.Image:
    """A small glowing ball: bright core fading into a soft tinted halo."""
    s = size * 4  # draw big, downsample for soft edges
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = s // 2
    steps = 10
    for i in range(steps, 0, -1):
        t = i / steps
        r = c * t
        a = round(30 + (1 - t) * 200)
        col = tuple(round(glow[j] + (core[j] - glow[j]) * (1 - t)) for j in range(3))
        d.ellipse((c - r, c - r, c + r, c + r), fill=col + (a,))
    return im.resize((size, size), Image.LANCZOS)


def build_orbs() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    radial_orb(18, (235, 225, 255), (124, 58, 237)).save(OUT / "shadow-orb.png")
    print(f"{(OUT / 'shadow-orb.png').relative_to(ROOT)}: 18x18")
    radial_orb(16, (90, 70, 120), (20, 12, 40)).save(OUT / "ink-orb.png")
    print(f"{(OUT / 'ink-orb.png').relative_to(ROOT)}: 16x16")


def main() -> None:
    build_monarch()
    build_shadow_beast()
    build_kraken()
    build_tentacle()
    build_orbs()


if __name__ == "__main__":
    main()
