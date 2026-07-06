#!/usr/bin/env python3
"""
Author the two medium-distance stages as Tiled-compatible JSON:

  level-05  "Shadow Monarch"  (shadow theme)  — bat ambushes, stone keeps
  level-06  "Crimson Shibuya" (crimson theme) — spike fields, snapvine pipes,
                                                vultures on patrol

Both are ~200 tiles wide (the short stages are ~134), same 14-tile height and
the same 8-tile terrain conventions as the existing levels. Deterministic:
running the script always produces the same maps.

Usage: python3 scripts/build-medium-levels.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEVELS = ROOT / "src" / "levels"

# Tile GIDs (see src/config/Tiles.ts)
GRASS, DIRT, STONE, BRICK, LUCKY, USED, SPIKE, PLATE, QUICKSAND, ICE = range(1, 11)

WIDTH = 200
HEIGHT = 14
TS = 32
GROUND = 12  # default ground-top row


class Builder:
    def __init__(self):
        self.grid = [[0] * WIDTH for _ in range(HEIGHT)]
        self.objects = []
        self._oid = 0

    # ----- terrain -----

    def ground(self, c0, c1, top=GROUND):
        """Solid ground columns [c0, c1): grass crest + dirt fill below."""
        for c in range(c0, c1):
            self.grid[top][c] = GRASS
            for r in range(top + 1, HEIGHT):
                self.grid[r][c] = DIRT

    def platform(self, c0, length, row, tile=STONE):
        for c in range(c0, c0 + length):
            self.grid[row][c] = tile

    def spikes(self, c0, c1, ground_top=GROUND):
        """Spike tiles sitting on top of the ground crest."""
        for c in range(c0, c1):
            self.grid[ground_top - 1][c] = SPIKE

    # ----- objects -----

    def obj(self, kind, x, y, name=None, props=None):
        self._oid += 1
        o = {
            "id": self._oid,
            "name": name or kind,
            "type": kind,
            "point": True,
            "x": x,
            "y": y,
            "width": 0,
            "height": 0,
            "visible": True,
            "rotation": 0,
        }
        if props:
            o["properties"] = props
        self.objects.append(o)

    def player(self, col, top=GROUND):
        self.obj("player", col * TS + 16, (top - 2) * TS, name="player_start")

    def beacon(self, col, top=GROUND):
        self.obj("beacon", col * TS, top * TS)

    def coin(self, col, row):
        self.obj("coin", col * TS + 16, row * TS + 16)

    def coin_row(self, c0, n, row, step=1):
        for i in range(n):
            self.coin(c0 + i * step, row)

    def lucky(self, col, row):
        self.obj("luckyblock", col * TS + 16, row * TS + 16)

    def brick(self, col, row):
        self.obj("brick", col * TS + 16, row * TS + 16)

    def plodder(self, col, top=GROUND):
        self.obj("plodder", col * TS + 16, top * TS)

    def pipe(self, col, top=GROUND, plant=True):
        self.obj(
            "pipe",
            col * TS + 32,
            top * TS,
            props=[{"name": "plant", "type": "bool", "value": plant}],
        )

    def bat(self, col, perch_row):
        """Bat hanging under a platform tile row (spawn y = platform underside)."""
        self.obj("bat", col * TS + 16, (perch_row + 1) * TS)

    def vulture(self, col, row, range_px=110):
        self.obj(
            "vulture",
            col * TS + 16,
            row * TS,
            props=[{"name": "range", "type": "float", "value": range_px}],
        )

    # ----- output -----

    def write(self, key, tileset):
        data = {
            "compressionlevel": -1,
            "width": WIDTH,
            "height": HEIGHT,
            "tilewidth": TS,
            "tileheight": TS,
            "infinite": False,
            "orientation": "orthogonal",
            "renderorder": "right-down",
            "tiledversion": "1.10.2",
            "version": "1.10",
            "type": "map",
            "nextlayerid": 3,
            "nextobjectid": self._oid + 1,
            "tilesets": [tileset],
            "layers": [
                {
                    "id": 1,
                    "name": "terrain",
                    "type": "tilelayer",
                    "x": 0,
                    "y": 0,
                    "width": WIDTH,
                    "height": HEIGHT,
                    "opacity": 1,
                    "visible": True,
                    "data": [v for row in self.grid for v in row],
                },
                {
                    "id": 2,
                    "name": "spawns",
                    "type": "objectgroup",
                    "draworder": "topdown",
                    "x": 0,
                    "y": 0,
                    "opacity": 1,
                    "visible": True,
                    "objects": self.objects,
                },
            ],
        }
        out = LEVELS / f"{key}.json"
        out.write_text(json.dumps(data, separators=(",", ":")))
        print(f"  {out.relative_to(ROOT)}  ({WIDTH}x{HEIGHT}, {len(self.objects)} spawns)")


def build_level_05():
    """Shadow Monarch — dark keep: bat ambush corridors, stone ledges."""
    b = Builder()
    b.player(3)

    # Opening run
    b.ground(0, 14)
    b.coin_row(6, 4, 10)

    # First gap with a plate step
    b.platform(15, 2, 10, PLATE)
    b.coin_row(15, 2, 8)
    b.ground(19, 34)
    b.brick(21, 8)
    b.lucky(22, 8)
    b.brick(23, 8)
    b.coin_row(21, 3, 5)
    b.plodder(25)
    b.plodder(30)

    # Gap with a stone island
    b.platform(35, 2, 9, STONE)
    b.coin_row(35, 2, 7)
    b.ground(38, 58)
    b.spikes(41, 43)
    # raised court with a bat perch above
    b.ground(44, 53, top=10)
    b.platform(46, 4, 6, STONE)
    b.bat(47, 6)
    b.coin_row(46, 4, 4)
    b.plodder(50, top=10)

    # Double-step chasm
    b.platform(59, 2, 10, PLATE)
    b.platform(61, 2, 8, PLATE)
    b.coin(61, 6)
    b.coin(62, 6)
    b.ground(63, 84)
    b.pipe(68)
    b.plodder(74)
    b.lucky(76, 8)
    b.plodder(79)
    b.coin_row(72, 4, 9)

    # Staircase up to the rampart
    b.ground(84, 86, top=11)
    b.ground(86, 88, top=10)
    b.ground(88, 98, top=9)
    b.spikes(93, 94, ground_top=9)
    b.coin_row(90, 4, 6)

    # Drop chasm off the rampart
    b.platform(100, 2, 10, PLATE)
    b.ground(104, 126)
    # bat corridor: two perches over the path
    b.platform(108, 3, 6, STONE)
    b.bat(109, 6)
    b.platform(116, 3, 6, STONE)
    b.bat(117, 6)
    b.coin_row(107, 6, 9, step=2)
    b.plodder(121)

    # Staggered plates over a wide chasm
    b.platform(127, 2, 10, PLATE)
    b.platform(129, 2, 8, PLATE)
    b.platform(131, 1, 10, PLATE)
    b.coin(129, 6)
    b.coin(130, 6)
    b.ground(132, 150)
    b.brick(136, 8)
    b.brick(137, 8)
    b.lucky(138, 8)
    b.brick(139, 8)
    b.brick(140, 8)
    b.coin_row(136, 5, 5)
    b.plodder(143)
    b.plodder(147)

    # Spiked approach to a raised terrace
    b.ground(150, 156, top=10)
    b.coin_row(151, 3, 8)
    b.ground(156, 176)
    # final bat tower
    b.platform(162, 4, 5, STONE)
    b.bat(163, 5)
    b.coin_row(160, 4, 9, step=2)
    b.pipe(170)

    # Home stretch
    b.ground(176, WIDTH)
    b.lucky(180, 8)
    b.coin_row(183, 4, 10)
    b.beacon(192)
    return b


def build_level_06():
    """Crimson Shibuya — cursed city: spike fields, snapvines, vultures."""
    b = Builder()
    b.player(3)

    # Opening street
    b.ground(0, 20)
    b.coin_row(6, 4, 10)
    b.pipe(15)

    # First gap
    b.platform(21, 2, 9, PLATE)
    b.coin_row(21, 2, 7)
    b.ground(25, 45)
    b.spikes(28, 31)
    b.vulture(34, 9, 110)
    b.brick(31, 8)
    b.lucky(32, 8)
    b.brick(33, 8)
    b.coin_row(31, 3, 5)
    b.plodder(38)
    b.plodder(42)

    # Gap with a low island
    b.platform(46, 2, 10, STONE)
    b.coin_row(46, 2, 8)
    # raised city block, then spiked low road
    b.ground(50, 58, top=10)
    b.coin_row(52, 3, 8)
    b.ground(58, 70)
    b.spikes(60, 63)
    b.pipe(66)

    # Wide chasm patrolled by a vulture
    b.platform(71, 2, 10, PLATE)
    b.platform(74, 2, 9, PLATE)
    b.vulture(73, 7, 80)
    b.coin(72, 8)
    b.coin(75, 7)
    b.ground(76, 96)
    b.brick(80, 8)
    b.brick(81, 8)
    b.lucky(82, 8)
    b.brick(83, 8)
    b.brick(84, 8)
    b.coin_row(80, 5, 5)
    b.plodder(87)
    b.plodder(91)
    b.spikes(93, 95)

    # Stairs up to the overpass
    b.ground(96, 98, top=11)
    b.ground(98, 100, top=10)
    b.ground(100, 112, top=9)
    b.spikes(105, 106, ground_top=9)
    b.spikes(108, 109, ground_top=9)
    b.coin_row(102, 4, 6)

    # Drop off the overpass
    b.platform(114, 2, 10, PLATE)
    b.ground(118, 140)
    # snapvine gauntlet
    b.pipe(122)
    b.plodder(127)
    b.pipe(130)
    b.plodder(134)
    b.vulture(137, 8, 96)
    b.coin_row(124, 5, 9, step=2)

    # Staggered plates
    b.platform(141, 2, 10, PLATE)
    b.platform(144, 2, 8, PLATE)
    b.coin(144, 6)
    b.coin(145, 6)
    b.ground(146, 166)
    b.spikes(150, 153)
    b.brick(156, 8)
    b.brick(157, 8)
    b.lucky(158, 8)
    b.brick(159, 8)
    b.coin_row(156, 4, 5)
    b.plodder(162)

    # Spiked ramp to the terrace
    b.ground(166, 172, top=10)
    b.coin_row(167, 3, 8)

    # Final avenue
    b.ground(172, WIDTH)
    b.lucky(178, 8)
    b.vulture(182, 9, 120)
    b.coin_row(184, 4, 10)
    b.beacon(192)
    return b


def main():
    # Reuse the exact tileset definition of an existing level so every map
    # stays consistent with the shipped terrain texture.
    tileset = json.loads((LEVELS / "level-04.json").read_text())["tilesets"][0]
    print("Building medium-distance levels…")
    build_level_05().write("level-05", tileset)
    build_level_06().write("level-06", tileset)
    print("Done.")


if __name__ == "__main__":
    main()
