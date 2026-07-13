#!/usr/bin/env python3
"""
Author the two boss arenas as Tiled-compatible JSON:

  level-08.json  "Monarchs Thron"  (shadow theme, 40 tiles)
      A sealed throne hall: flat fighting floor, two side ledges and a small
      center perch to dodge the Monarch's shadow bolts and arena-wide dash.

  level-09.json  "Krakenbucht"     (lagoon theme, 44 tiles)
      Two shores around a deep pool the Kraken lurks in. A plank platform
      hangs over the pool — the stomp route onto the slumped head during the
      vulnerable window. Tentacles strike the shores, ink blobs rain in arcs.

Boss stages have NO coins and NO beacon: the fight ends the level (the boss
spawn replaces the goal). Terrain conventions match build-level-07.py.

Usage: python3 scripts/build-boss-arenas.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEVELS = ROOT / "src" / "levels"

# Tile GIDs (see src/config/Tiles.ts)
GRASS, DIRT, STONE, BRICK, LUCKY, USED, SPIKE, PLATE, QUICKSAND, ICE = range(1, 11)

HEIGHT = 14
TS = 32
GROUND = 12  # default ground-top row


class Builder:
    def __init__(self, width):
        self.width = width
        self.grid = [[0] * width for _ in range(HEIGHT)]
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

    def wall(self, c0, c1, tile=DIRT):
        """Full-height solid columns (arena side walls)."""
        for r in range(HEIGHT):
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

    def boss(self, kind, col, top=GROUND):
        self.obj(
            "boss",
            col * TS + 16,
            top * TS,
            props=[{"name": "kind", "type": "string", "value": kind}],
        )

    def item_block(self, col, row):
        """The arena supply "?" block: always a combat item, re-arms in-game."""
        self.obj("itemblock", col * TS + 16, row * TS + 16)

    def water(self, c0, c1, surface_row=GROUND):
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

    # ----- output -----

    def write(self, key, tileset):
        data = {
            "compressionlevel": -1,
            "width": self.width,
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
                    "width": self.width,
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
        print(f"  {out.relative_to(ROOT)}  ({self.width}x{HEIGHT}, {len(self.objects)} spawns)")


def build_monarch_arena():
    """Monarchs Thron — a wide arcane hall for the Shadow Monarch. Generous
    floor space and a whole ring of ledges: the dash sweeps only the floor,
    so there is always a safe perch within one jump."""
    b = Builder(52)
    b.wall(0, 1)
    b.wall(50, 51)
    b.ground(2, 50)

    # Four side ledges + a high center perch: plenty of routes to break
    # line-of-sight from the bolt volleys and to hop over the dash.
    b.platform(6, 4, 8)
    b.platform(14, 4, 9)
    b.platform(34, 4, 9)
    b.platform(42, 4, 8)
    b.platform(23, 5, 5, PLATE)

    # Supply block under the perch: hit it from the floor for a combat item.
    b.item_block(25, 8)

    b.player(6)
    b.boss("monarch", 40)
    return b


def build_kraken_arena():
    """Krakenbucht — two WIDE shores around the Kraken's pool, each with a
    raised ledge. Tentacles only root on the ground (see KrakenBoss), so the
    ledges and the plank are genuine safe perches during the tentacle phase."""
    b = Builder(56)
    b.wall(0, 1)
    b.wall(54, 55)

    # Left and right shore, raised above a deep center pool.
    b.ground(2, 22, top=10)
    b.ground(34, 54, top=10)
    # Pool floor (bottom row) so swimmers and sinking ink stay contained.
    for c in range(22, 34):
        b.grid[13][c] = DIRT
    b.water(22, 33, surface_row=10)

    # Tentacle-safe ledges on both shores + the plank over the pool
    # (the stomp route onto the slumped head).
    b.platform(8, 4, 7)
    b.platform(44, 4, 7)
    b.platform(26, 4, 6, PLATE)

    # Supply block over the left shore: hit it from the sand for a combat item.
    b.item_block(15, 7)

    b.player(6, top=10)
    b.boss("kraken", 28, top=13)
    return b


def main():
    # Reuse the exact tileset definition of an existing level so the maps stay
    # consistent with the shipped terrain texture (GID layout is shared).
    tileset = json.loads((LEVELS / "level-04.json").read_text())["tilesets"][0]
    print("Building boss arenas…")
    build_monarch_arena().write("level-08", tileset)
    build_kraken_arena().write("level-09", tileset)
    print("Done.")


if __name__ == "__main__":
    main()
