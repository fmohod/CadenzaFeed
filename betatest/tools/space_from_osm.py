"""space_from_osm.py -- turn vendored OpenStreetMap geometry into a playable Space.

    py -3.11 betatest/tools/space_from_osm.py discovery-green

Reads  content/geo/<slug>.osm.json  (vendored, attributed OSM data; see its _readme)
Writes content/spaces/<slug>.json    (the Space the world engine loads)

OFFLINE and deterministic: no network, same input -> same map. Coordinates anchor
the place to reality; the map is a rasterisation at TILE_M metres per tile and is
free to be wrong in the ways a game needs (Machine Head, 2026-09-03). The Space
never knows the registry exists: the binding place<->space lives in world.json.

Tile vocabulary (world/space.js): G grass, g garden bed (blocked), ~ water
(blocked), S sidewalk/path, p paved plaza, R road, B building, T tree, X void.
"""
import json
import math
import sys
from pathlib import Path

TILE_M = 5.0            # metres per tile
MARGIN_M = 30.0         # city context around the park polygon
ROAD_WIDTH = {"primary": 4, "secondary": 3, "secondary_link": 2, "tertiary": 3,
              "unclassified": 2, "residential": 2, "service": 1}
PASSABLE_CODES = "GSpR-DM"

HERE = Path(__file__).resolve().parent
CONTENT = HERE.parent / "content"


# ---- geometry ---------------------------------------------------------------

class Projection:
    def __init__(self, lat_min, lat_max, lon_min, lon_max):
        self.lat0 = (lat_min + lat_max) / 2
        self.mx = 111320.0 * math.cos(math.radians(self.lat0))   # metres per degree lon
        self.my = 110574.0                                        # metres per degree lat
        self.lon_min, self.lat_max = lon_min, lat_max
        self.width = int(math.ceil((lon_max - lon_min) * self.mx / TILE_M))
        self.height = int(math.ceil((lat_max - lat_min) * self.my / TILE_M))

    def tile(self, lat, lon):
        x = (lon - self.lon_min) * self.mx / TILE_M
        y = (self.lat_max - lat) * self.my / TILE_M
        return int(x), int(y)


def point_in_poly(x, y, poly):
    inside = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            xi = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if x < xi:
                inside = not inside
    return inside


def line_tiles(p0, p1):
    """Bresenham between two tile coords."""
    x0, y0 = p0
    x1, y1 = p1
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    while True:
        yield x0, y0
        if x0 == x1 and y0 == y1:
            return
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


# ---- rasteriser -------------------------------------------------------------

class Grid:
    def __init__(self, w, h, fill):
        self.w, self.h = w, h
        self.cells = [[fill] * w for _ in range(h)]

    def set(self, x, y, code):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.cells[y][x] = code

    def get(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.cells[y][x]
        return "X"

    def fill_poly(self, poly_tiles, code, only_over=None):
        xs = [p[0] for p in poly_tiles]
        ys = [p[1] for p in poly_tiles]
        for y in range(max(0, min(ys)), min(self.h, max(ys) + 1)):
            for x in range(max(0, min(xs)), min(self.w, max(xs) + 1)):
                if point_in_poly(x + 0.5, y + 0.5, poly_tiles):
                    if only_over is None or self.cells[y][x] in only_over:
                        self.cells[y][x] = code

    def stroke(self, pts, code, width=1, only_over=None, every=1):
        k = 0
        for a, b in zip(pts, pts[1:]):
            for x, y in line_tiles(a, b):
                k += 1
                if k % every:
                    continue
                r = width // 2
                for yy in range(y - r, y - r + width):
                    for xx in range(x - r, x - r + width):
                        if only_over is None or self.get(xx, yy) in only_over:
                            self.set(xx, yy, code)

    def rows(self):
        return ["".join(r) for r in self.cells]


def nearest_walkable(grid, x, y, radius=6):
    best = None
    for r in range(radius + 1):
        for yy in range(y - r, y + r + 1):
            for xx in range(x - r, x + r + 1):
                if grid.get(xx, yy) in PASSABLE_CODES:
                    d = abs(xx - x) + abs(yy - y)
                    if best is None or d < best[0]:
                        best = (d, xx, yy)
        if best:
            return best[1], best[2]
    return None


# ---- build --------------------------------------------------------------------

def build(slug):
    src = json.load(open(CONTENT / "geo" / f"{slug}.osm.json", encoding="utf-8"))
    els = src["elements"]
    park = src["park"]
    park_way = next(e for e in els if e["type"] == park["osm_type"] and e["id"] == park["osm_id"])
    park_geo = park_way["geometry"]

    lats = [p[0] for p in park_geo]
    lons = [p[1] for p in park_geo]
    pad_lat = MARGIN_M / 110574.0
    pad_lon = MARGIN_M / (111320.0 * math.cos(math.radians(sum(lats) / len(lats))))
    proj = Projection(min(lats) - pad_lat, max(lats) + pad_lat, min(lons) - pad_lon, max(lons) + pad_lon)
    T = lambda pt: proj.tile(pt[0], pt[1])

    grid = Grid(proj.width, proj.height, "p")          # the city: paved by default
    park_tiles = [T(p) for p in park_geo]

    # 1. roads first, so the park and buildings paint over their edges cleanly
    for e in els:
        t = e["tags"]
        hw = t.get("highway")
        if e["type"] == "way" and hw in ROAD_WIDTH:
            grid.stroke([T(p) for p in e["geometry"]], "R", ROAD_WIDTH[hw])
    # 2. the park itself
    grid.fill_poly(park_tiles, "G")
    # 3. areas inside: gardens, water, pitches, plazas
    def area_geoms(e):
        if e["type"] == "way" and len(e.get("geometry", [])) > 3 and e["geometry"][0] == e["geometry"][-1]:
            return [e["geometry"]]
        if e["type"] == "relation":
            return [m["geometry"] for m in e.get("members", []) if m.get("role") in ("outer", "") and len(m["geometry"]) > 3]
        return []
    for e in els:
        t = e["tags"]
        code = None
        if t.get("natural") == "water" or t.get("water"):
            code = "~"
        elif t.get("leisure") == "garden":
            code = "g"
        elif t.get("leisure") in ("pitch", "dog_park"):
            code = "p"
        elif t.get("highway") == "pedestrian" and t.get("area") == "yes":
            code = "p"
        if code:
            for g in area_geoms(e):
                grid.fill_poly([T(p) for p in g], code, only_over="Ggp")
    # 4. paths through the park
    for e in els:
        t = e["tags"]
        if e["type"] == "way" and t.get("highway") in ("footway", "pedestrian", "cycleway", "steps", "path") and t.get("area") != "yes":
            grid.stroke([T(p) for p in e["geometry"]], "S", 1, only_over="Gg~p")
    # 5. buildings (inside and around)
    for e in els:
        if e["tags"].get("building"):
            for g in area_geoms(e):
                grid.fill_poly([T(p) for p in g], "B")
    # 6. tree rows: a tree every second tile, never on a path
    for e in els:
        if e["type"] == "way" and e["tags"].get("natural") == "tree_row":
            grid.stroke([T(p) for p in e["geometry"]], "T", 1, only_over="Gg", every=2)
    # 7. sidewalks: a walkable ring where road meets anything else
    for y in range(grid.h):
        for x in range(grid.w):
            if grid.get(x, y) == "R":
                for xx, yy in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)):
                    if grid.get(xx, yy) in ("p", "B"):
                        pass
    # 8. named things inside the park become examine points
    interactables, seen = [], set()
    KIND = [("tourism", "artwork", "Public art"), ("amenity", "fountain", "A fountain"),
            ("amenity", "theatre", "An outdoor stage"), ("amenity", "library", "A reading room"),
            ("amenity", "cafe", "A café"), ("amenity", "restaurant", "A restaurant"), ("amenity", "bar", "A bar"),
            ("leisure", "pitch", "A court"), ("natural", "tree", "A tree"), ("leisure", "garden", "A garden")]
    for e in els:
        t = e["tags"]
        name = t.get("name")
        if not name or e["type"] != "node":
            continue
        x, y = T((e["lat"], e["lon"]))
        if not point_in_poly(x + 0.5, y + 0.5, park_tiles):
            continue
        kind = next((label for k, v, label in KIND if t.get(k) == v), "A place in the park")
        text = f"{kind}: {name}."
        if t.get("artist_name"):
            text += f" Artist: {t['artist_name']}."
        base = "examine:" + "".join(c if c.isalnum() else "-" for c in name.lower()).strip("-")
        eid = base
        n = 2
        while eid in seen:
            eid = f"{base}-{n}"
            n += 1
        seen.add(eid)
        interactables.append({"id": eid, "type": "examine", "x": x, "y": y, "label": name, "text": [text], "osm": f"node/{e['id']}"})

    # 9. spawn and exit at the park's west edge (nearest walkable to the west midpoint)
    west = min(park_tiles, key=lambda p: p[0])
    sp = nearest_walkable(grid, west[0] + 1, west[1]) or (grid.w // 2, grid.h // 2)
    spawns = [{"id": "spawn:default", "x": sp[0], "y": sp[1], "facing": "right"},
              {"id": "spawn:from-block", "x": sp[0], "y": sp[1], "facing": "right"}]
    exits = [{"id": "exit:bus-stop", "x": sp[0] - 1, "y": sp[1], "trigger": "interact", "label": "Bus back to the block",
              "to": {"space": "space:community-block", "spawn": "spawn:from-downtown"}}]
    grid.set(sp[0] - 1, sp[1], "S")

    space = {
        "schema": 1,
        "id": f"space:{slug}",
        "name": park["name"],
        "kind": "exterior",
        "theme": "street",
        "canon": "documentary",
        "neighborhood": src.get("neighborhood", "downtown"),
        "_note": "GENERATED by betatest/tools/space_from_osm.py from content/geo/" + slug + ".osm.json. Do not hand-edit the map; edit the generator or the geometry. Map data © OpenStreetMap contributors, ODbL.",
        "source": {"osm": f"{park['osm_type']}/{park['osm_id']}", "attribution": src["attribution"], "license": src["license"], "fetched": src["fetched"], "tile_metres": TILE_M},
        "anchor": {"lat_max": proj.lat_max, "lon_min": proj.lon_min, "metres_per_tile": TILE_M},
        "map": grid.rows(),
        "spawns": spawns,
        "exits": exits,
        "interactables": interactables,
        "npcs": [],
    }
    out = CONTENT / "spaces" / f"{slug}.json"
    out.write_text(json.dumps(space, ensure_ascii=False, indent=1), encoding="utf-8")
    counts = {}
    for row in space["map"]:
        for c in row:
            counts[c] = counts.get(c, 0) + 1
    print(f"wrote {out}  {grid.w}x{grid.h} tiles at {TILE_M} m; {len(interactables)} examine points; spawn {sp}")
    print("tiles:", dict(sorted(counts.items(), key=lambda kv: -kv[1])))
    return space


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "discovery-green")
