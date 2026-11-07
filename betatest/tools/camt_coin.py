"""camt_coin.py - the CAMT NPC's coin: the real Cadenza Arthouse logo stamped on a gold coin.

Owner, log 20260912-02: the studio's tools as a character on the station, "the actual
Cadenza Arthouse logo looking like a coin". Reads F:\\Apps\\Libraries\\assets\\logo.png
(the master logo, never redrawn by hand), keys out its white background, scales the ink
to the coin face and writes content/sprites/camt-coin.png. Rerun after a logo change.

The 2026-09-12 coin was blank: the logo is a wide image on opaque white, and that pass
stamped the whole rectangle as ink at 48 px, so the face read as a dark plate.

    py -3.11 betatest/tools/camt_coin.py [--size 96]
"""
import argparse
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
LOGO = r"F:\Apps\Libraries\assets\logo.png"
OUT = os.path.join(HERE, "..", "content", "sprites", "camt-coin.png")

GOLD = (214, 172, 96, 255)
RIM = (160, 120, 64, 255)
RIM_DARK = (120, 86, 40, 255)
INK = (60, 40, 20, 255)
GLINT = (240, 220, 170, 255)


def logo_ink(path):
    """The logo's strokes as an 'L' mask: dark, opaque pixels are ink; white is not."""
    im = Image.open(path).convert("RGBA")
    px = im.load()
    mask = Image.new("L", im.size, 0)
    mp = mask.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a > 96 and (r + g + b) < 3 * 128:
                mp[x, y] = 255
    bbox = mask.getbbox()
    if not bbox:
        sys.exit("logo has no dark strokes to stamp")
    return mask.crop(bbox)


def coin(size, ink):
    s = 8  # supersample so the disc and the stamp are smooth before the final shrink
    big = size * s
    im = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((0, 0, big - 1, big - 1), fill=RIM_DARK)
    d.ellipse((s, s, big - 1 - s, big - 1 - s), fill=RIM)
    inset = int(big * 0.09)
    d.ellipse((inset, inset, big - 1 - inset, big - 1 - inset), fill=GOLD)
    ring = int(big * 0.13)
    d.ellipse((ring, ring, big - 1 - ring, big - 1 - ring), outline=RIM_DARK, width=max(1, s // 2))
    # the stamp: fit the strokes inside the face, widest dimension at 78% of the coin
    face = int(big * 0.78)
    w, h = ink.size
    k = min(face / w, face / h)
    stamp = ink.resize((max(1, int(w * k)), max(1, int(h * k))), Image.LANCZOS)
    layer = Image.new("RGBA", stamp.size, INK)
    im.paste(layer, ((big - stamp.width) // 2, (big - stamp.height) // 2), stamp)
    # one glint on the rim, upper left
    gx, gy = int(big * 0.18), int(big * 0.14)
    d.ellipse((gx, gy, gx + s * 2, gy + s * 2), fill=GLINT)
    return im.resize((size, size), Image.LANCZOS)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--size", type=int, default=96)
    ap.add_argument("--logo", default=LOGO)
    ap.add_argument("--out", default=OUT)
    a = ap.parse_args()
    im = coin(a.size, logo_ink(a.logo))
    im.save(a.out, optimize=True)
    print(f"wrote {os.path.abspath(a.out)} {im.size[0]}x{im.size[1]}")


if __name__ == "__main__":
    main()
