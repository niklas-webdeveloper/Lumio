#!/usr/bin/env python3
"""
Author level 7 "Tropic Lagoon" (lagoon theme) as Tiled-compatible JSON.

A medium-distance tropical stage (~200 playfield tiles) that leans harder on
platforming than 5/6: log-branch step chains over water gaps, frog ambushes
(the new arcing hopper), spike runs, and the game's first WARP PIPE — stand on
its mouth and press ↓ to drop into a hidden cave room (built off-screen to the
right of the beacon, walled off from the playfield) holding two frogs, two "?"
blocks and a coin hoard, with a second warp pipe leading back up to the trail.

Terrain conventions match build-medium-levels.py; the two new object kinds are:
  warppipe   {target: <warppoint name>}  — enterable pipe
  warppoint  (named point)               — warp destination

Usage: python3 scripts/build-level-07.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEVELS = ROOT / "src" / "levels"

# Tile GIDs (see src/config/Tiles.ts)
GRASS, DIRT, STONE, BRICK, LUCKY, USED, SPIKE, PLATE, QUICKSAND, ICE = range(1, 11)

WIDTH = 224   # 200-tile playfield + hidden bonus room behind the end wall
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
        for c in range(c0, c1):
            self.grid[top][c] = GRASS
            for r in range(top + 1, HEIGHT):
                self.grid[r][c] = DIRT

    def platform(self, c0, length, row, tile=STONE):
        for c in range(c0, c0 + length):
            self.grid[row][c] = tile

    def spikes(self, c0, c1, ground_top=GROUND):
        for c in range(c0, c1):
            self.grid[ground_top - 1][c] = SPIKE

    def box(self, c0, c1, r0, r1, tile=BRICK):
        """Hollow rectangle of solid tiles (bonus-room shell)."""
        for c in range(c0, c1 + 1):
            self.grid[r0][c] = tile
            self.grid[r1][c] = tile
        for r in range(r0, r1 + 1):
            self.grid[r][c0] = tile
            self.grid[r][c1] = tile

    def fill(self, c0, c1, r0, r1, tile=BRICK):
        for r in range(r0, r1 + 1):
            for c in range(c0, c1 + 1):
                self.grid[r][c] = tile

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

    def frog(self, col, top=GROUND):
        self.obj("frog", col * TS + 16, top * TS)

    def pipe(self, col, top=GROUND, plant=True):
        self.obj(
            "pipe",
            col * TS + 32,
            top * TS,
            props=[{"name": "plant", "type": "bool", "value": plant}],
        )

    def warp_pipe(self, col, target, top=GROUND):
        self.obj(
            "warppipe",
            col * TS + 32,
            top * TS,
            props=[{"name": "target", "type": "string", "value": target}],
        )

    def warp_point(self, name, col, row):
        self.obj("warppoint", col * TS + 16, row * TS, name=name)

    def water(self, c0, c1, surface_row=GROUND):
        """Swimmable water zone filling a ground gap (cols c0..c1 inclusive).

        The surface sits a few px below the neighbouring ground top so the
        shoreline reads right; the zone runs to the map bottom (the game
        clamps swimmers to the zone's lower edge — no falling out).
        """
        self._oid += 1
        y = surface_row * TS + 8
        self.objects.append({
            "id": self._oid,
            "name": "water",
            "type": "water",
            "x": c0 * TS,
            "y": y,
            "width": (c1 - c0 + 1) * TS,
            "height": HEIGHT * TS - y,
            "visible": True,
            "rotation": 0,
        })

    def bat(self, col, perch_row):
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


def build_level_07():
    """Tropic Lagoon — jungle shore: log-branch chains, frog ambushes, and a
    warp pipe down into a hidden cave hoard."""
    b = Builder()
    b.player(3)

    # Beach opening: gentle warm-up, first frog on the sand.
    b.ground(0, 16)
    b.coin_row(6, 4, 10)
    b.frog(12)

    # First water gap: two log branches, slightly offset heights. Falling in
    # is no longer deadly — the lagoon is swimmable (paddle out and hop back).
    b.water(16, 22)
    b.platform(17, 2, 10, PLATE)
    b.platform(20, 2, 9, PLATE)
    b.coin_row(17, 2, 8)
    b.coin_row(20, 2, 7)
    b.ground(23, 40)
    b.brick(26, 8)
    b.lucky(27, 8)
    b.brick(28, 8)
    b.coin_row(26, 3, 5)
    b.plodder(31)
    b.frog(36)

    # Wooden-block towers over a spike run.
    b.ground(41, 44, top=13)  # sunken spike floor under the crossing
    b.spikes(41, 44, ground_top=13)
    b.platform(41, 2, 9, STONE)
    b.platform(44, 2, 7, STONE)
    b.coin_row(41, 2, 7)
    b.coin_row(44, 2, 5)
    b.ground(46, 62)
    b.frog(50)
    b.plodder(55)
    b.spikes(58, 60)

    # The WARP PIPE court: golden sparkles mark it; ↓ drops into the cave room.
    b.ground(62, 78)
    b.warp_pipe(66, "cave_in")
    b.warp_point("trail_out", 67, 9)  # re-entry: pops out on the pipe mouth
    b.coin_row(71, 3, 10)
    b.brick(73, 8)
    b.lucky(74, 8)
    b.brick(75, 8)

    # Vulture strait: three log steps over a wide water gap.
    b.water(78, 87)
    b.platform(79, 2, 10, PLATE)
    b.platform(82, 2, 8, PLATE)
    b.platform(85, 2, 10, PLATE)
    b.vulture(83, 6, 96)
    b.coin(80, 8)
    b.coin(83, 6)
    b.coin(86, 8)
    b.ground(88, 108)
    b.frog(92)
    b.plodder(97)
    b.pipe(102)

    # Raised jungle terrace with a bat under the canopy platform.
    b.ground(108, 118, top=10)
    b.platform(110, 4, 6, STONE)
    b.bat(111, 6)
    b.coin_row(110, 4, 4)
    b.ground(118, 134)
    b.spikes(121, 124)
    b.frog(127)
    b.plodder(131)

    # Long log-chain crossing — the stage's platforming centrepiece.
    b.water(134, 148)
    b.platform(135, 2, 10, PLATE)
    b.platform(138, 2, 8, PLATE)
    b.platform(141, 1, 6, PLATE)
    b.platform(143, 2, 8, PLATE)
    b.platform(146, 2, 10, PLATE)
    b.vulture(141, 9, 120)
    b.coin(138, 6)
    b.coin(141, 4)
    b.coin(144, 6)
    b.ground(149, 168)
    b.brick(153, 8)
    b.lucky(154, 8)
    b.brick(155, 8)
    b.coin_row(153, 3, 5)
    b.frog(158)
    b.frog(162)
    b.spikes(164, 166)

    # Stairs up to the headland, spiked crest.
    b.ground(168, 170, top=11)
    b.ground(170, 172, top=10)
    b.ground(172, 184, top=9)
    b.spikes(176, 177, ground_top=9)
    b.coin_row(174, 4, 6)
    b.plodder(180, top=9)

    # Home shore.
    b.ground(184, 200)
    b.lucky(188, 8)
    b.coin_row(190, 4, 10)
    b.beacon(194)

    # ---- Hidden cave room (behind the end wall; only reachable by warp) ----
    # Full-height wall seals the playfield; the room is a purple-brick cave.
    b.fill(200, 202, 0, HEIGHT - 1, DIRT)
    b.box(204, 221, 4, 13, BRICK)
    b.fill(204, 221, 12, 13, BRICK)              # thick floor
    b.platform(206, 2, 11, USED)                 # leaf hedge in the left corner
    b.warp_point("cave_in", 209, 7)              # drop-in point (falls to floor)
    b.lucky(210, 8)
    b.lucky(213, 8)
    b.coin_row(208, 8, 10)
    b.coin_row(210, 4, 6)
    b.frog(212, top=11)                          # two cave guards
    b.frog(215, top=11)
    b.warp_pipe(218, "trail_out", top=12)        # exit pipe back up to the trail
    return b


def main():
    # Reuse the exact tileset definition of an existing level so the map stays
    # consistent with the shipped terrain texture (GID layout is shared).
    tileset = json.loads((LEVELS / "level-04.json").read_text())["tilesets"][0]
    print("Building level 07…")
    build_level_07().write("level-07", tileset)
    print("Done.")


if __name__ == "__main__":
    main()
