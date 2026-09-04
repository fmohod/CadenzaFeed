"""fetch_osm.py -- vendor OpenStreetMap geometry for one place, with attribution.

    py -3.11 betatest/tools/fetch_osm.py <slug> "<Nominatim query>" [--neighborhood <slug>] [--margin 30]

Writes content/geo/<slug>.osm.json: the place's boundary polygon (from Nominatim,
the first result carrying a polygon) plus every way, named node and area
relation inside the padded bounding box (from Overpass). This is the ONLY step
that touches the network, and it is run by a person or a session, never by a
job: the output is committed, and space_from_osm.py works from it offline.

Data (c) OpenStreetMap contributors, ODbL 1.0 -- the attribution travels in the
file and into the generated space. Nominatim and Overpass usage policies: an
identifying User-Agent, one request at a time, nothing bulk.
"""
import argparse
import datetime
import json
import math
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

UA = "CadenzaArthouseMediaTools/registry-research (contact: fmohod@gmail.com)"
KEEP = ("name", "natural", "water", "leisure", "highway", "building", "amenity", "tourism",
        "man_made", "landuse", "artist_name", "artwork_type", "footway", "area", "surface", "playground", "sport")
CONTENT = Path(__file__).resolve().parent.parent / "content"


def get_json(url, data=None, timeout=90):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA})
    return json.load(urllib.request.urlopen(req, timeout=timeout))


def nominatim(query):
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
        {"q": query, "format": "jsonv2", "limit": 5, "polygon_geojson": 1, "countrycodes": "us"})
    for r in get_json(url, timeout=30):
        g = r.get("geojson") or {}
        if g.get("type") in ("Polygon", "MultiPolygon"):
            return r
    return None


def overpass(south, west, north, east):
    q = f"""[out:json][timeout:90];
(
  way({south},{west},{north},{east});
  node({south},{west},{north},{east})["name"];
  relation({south},{west},{north},{east})["natural"];
  relation({south},{west},{north},{east})["water"];
  relation({south},{west},{north},{east})["leisure"];
  relation({south},{west},{north},{east})["building"];
);
out geom tags;"""
    return get_json("https://overpass-api.de/api/interpreter",
                    data=urllib.parse.urlencode({"data": q}).encode())


def trim(elements):
    out = []
    for e in elements:
        t = {k: v for k, v in (e.get("tags") or {}).items() if k in KEEP}
        item = {"type": e["type"], "id": e["id"], "tags": t}
        if e["type"] == "node":
            item["lat"], item["lon"] = e["lat"], e["lon"]
        elif e["type"] == "way":
            item["geometry"] = [[round(p["lat"], 7), round(p["lon"], 7)] for p in e.get("geometry", [])]
        elif e["type"] == "relation":
            item["members"] = [{"role": m.get("role"), "type": m["type"],
                                "geometry": [[round(p["lat"], 7), round(p["lon"], 7)] for p in m.get("geometry", [])]}
                               for m in e.get("members", []) if m.get("geometry")]
        out.append(item)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("query")
    ap.add_argument("--neighborhood", default=None)
    ap.add_argument("--margin", type=float, default=30.0, help="metres of city context around the polygon")
    a = ap.parse_args()

    hit = nominatim(a.query)
    if not hit:
        print(f"Nominatim found no polygon for {a.query!r}", file=sys.stderr)
        return 1
    geo = hit["geojson"]
    ring = geo["coordinates"][0] if geo["type"] == "Polygon" else max(geo["coordinates"], key=lambda p: len(p[0]))[0]
    ring_latlon = [[round(lon_lat[1], 7), round(lon_lat[0], 7)] for lon_lat in ring]
    lats = [p[0] for p in ring_latlon]
    lons = [p[1] for p in ring_latlon]
    pad_lat = a.margin / 110574.0
    pad_lon = a.margin / (111320.0 * math.cos(math.radians(sum(lats) / len(lats))))
    south, north = min(lats) - pad_lat, max(lats) + pad_lat
    west, east = min(lons) - pad_lon, max(lons) + pad_lon
    time.sleep(1.2)
    elements = trim(overpass(f"{south:.5f}", f"{west:.5f}", f"{north:.5f}", f"{east:.5f}")["elements"])

    osm_type, osm_id = hit["osm_type"], hit["osm_id"]
    # Make sure the boundary itself is present as a way with geometry even when
    # Nominatim's hit was a relation (Overpass returns member ways with geometry).
    if not any(e["type"] == "way" and e["id"] == osm_id for e in elements):
        elements.insert(0, {"type": "way", "id": osm_id, "tags": {"name": hit.get("name") or a.slug, "leisure": "park"},
                            "geometry": ring_latlon, "_synthetic": "boundary ring from Nominatim polygon_geojson"})
        osm_type = "way"

    vend = {
        "_readme": f"Vendored OpenStreetMap data for the {a.slug} space. Read by betatest/tools/space_from_osm.py (offline) to generate content/spaces/{a.slug}.json. Regenerate by re-running tools/fetch_osm.py; never hand-edit.",
        "attribution": "© OpenStreetMap contributors",
        "license": "ODbL 1.0 — https://www.openstreetmap.org/copyright",
        "source": f"Nominatim ({a.query!r} → {hit['osm_type']}/{hit['osm_id']}, {hit.get('display_name')}) + Overpass API, bbox {south:.5f},{west:.5f},{north:.5f},{east:.5f}",
        "fetched": datetime.date.today().isoformat(),
        "park": {"osm_type": osm_type, "osm_id": osm_id, "name": hit.get("name") or a.query, "centroid": {"lat": float(hit["lat"]), "lon": float(hit["lon"])}},
        "neighborhood": a.neighborhood,
        "elements": elements,
    }
    out = CONTENT / "geo" / f"{a.slug}.osm.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(vend, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {out}: {len(elements)} elements, boundary {osm_type}/{osm_id} '{vend['park']['name']}', centroid {hit['lat']},{hit['lon']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
