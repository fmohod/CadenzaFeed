"""Randy Boy, upright, in the suit: a pixel sprite sheet for Universe B.

    py -3.11 betatest/tools/randy_biped.py   -> content/sprites/randy-biped.png (+ .json)

Owner, log 20261006-01: "a randy npc in the game that walks upright on two legs
and has a suit ... you're gonna have to design this sprite from a couple of
different angles ... so he can walk around the map." Canon (CHARACTERS.md): pale
ginger tabby, white chin, the navy suit with the flute -- the suit is Universe B
attire only. Every animal wears trousers.

Sheet: 4 rows (down, up, left, right) x 4 frames (idle, step A, step B, flute
up), 16 x 24 px each, drawn here in code so it can be regenerated and so the
production art from the Flutie Cats asset route can replace it file for file.
"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "content" / "sprites" / "randy-biped.png"
FW, FH = 16, 24

FUR = (232, 150, 63)      # pale ginger (the painter's accent)
FUR_D = (164, 86, 30)     # stripes / dark
CHIN = (242, 240, 234)
NAVY = (31, 42, 74)
NAVY_L = (44, 58, 100)
SHIRT = (242, 240, 234)
TIE = (160, 48, 48)
SKIN = (220, 160, 120)    # inner ear
EYE = (16, 18, 20)
SHOE = (24, 20, 18)
FLUTE = (198, 204, 212)
KEY = (232, 200, 96)


def px(d, x, y, c):
    d.point((x, y), fill=c)


def rect(d, x0, y0, x1, y1, c):
    d.rectangle((x0, y0, x1, y1), fill=c)


def frame(facing, step, flute):
    im = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    lift = 1 if step == 1 else 0          # a little bounce on the first step
    y0 = 1 - lift
    # --- head (6..9 wide), ears ---
    rect(d, 5, y0 + 2, 10, y0 + 7, FUR)
    if facing in ("down", "up", "left", "right"):
        # ears
        px(d, 5, y0 + 1, FUR); px(d, 10, y0 + 1, FUR)
        px(d, 5, y0, FUR_D); px(d, 10, y0, FUR_D)
        if facing == "down":
            px(d, 5, y0 + 1, SKIN); px(d, 10, y0 + 1, SKIN)
    # tabby stripes on the forehead
    if facing != "up":
        px(d, 7, y0 + 2, FUR_D); px(d, 8, y0 + 2, FUR_D)
        px(d, 6, y0 + 3, FUR_D); px(d, 9, y0 + 3, FUR_D)
    else:
        rect(d, 6, y0 + 2, 9, y0 + 3, FUR_D)
    # face
    if facing == "down":
        px(d, 6, y0 + 5, EYE); px(d, 9, y0 + 5, EYE)
        rect(d, 7, y0 + 7, 8, y0 + 7, CHIN)          # white chin
    elif facing == "left":
        px(d, 6, y0 + 5, EYE); rect(d, 5, y0 + 7, 6, y0 + 7, CHIN)
        px(d, 4, y0 + 6, FUR)                        # muzzle
    elif facing == "right":
        px(d, 9, y0 + 5, EYE); rect(d, 9, y0 + 7, 10, y0 + 7, CHIN)
        px(d, 11, y0 + 6, FUR)
    # --- body: suit ---
    by = y0 + 8
    rect(d, 5, by, 10, by + 6, NAVY)                 # jacket
    if facing == "down":
        rect(d, 7, by, 8, by + 3, SHIRT)             # shirt opening
        rect(d, 7, by + 1, 8, by + 4, TIE)           # tie
        px(d, 7, by, SHIRT); px(d, 8, by, SHIRT)
        px(d, 5, by + 1, NAVY_L); px(d, 10, by + 1, NAVY_L)   # lapels
    elif facing == "up":
        px(d, 7, by + 2, NAVY_L); px(d, 8, by + 2, NAVY_L)    # back seam
    else:
        px(d, 7 if facing == "left" else 8, by + 1, SHIRT)
        px(d, 7 if facing == "left" else 8, by + 2, TIE)
    # arms (swing with the step)
    swing = {0: 0, 1: 1, 2: -1}[step]
    if facing in ("down", "up"):
        rect(d, 4, by + 1 + max(0, swing), 4, by + 5 + max(0, swing), NAVY)
        rect(d, 11, by + 1 + max(0, -swing), 11, by + 5 + max(0, -swing), NAVY)
        px(d, 4, by + 6 + max(0, swing), FUR); px(d, 11, by + 6 + max(0, -swing), FUR)   # paws
    else:
        ax = 6 if facing == "left" else 9
        rect(d, ax + swing, by + 1, ax + swing, by + 5, NAVY)
        px(d, ax + swing, by + 6, FUR)
    # --- trousers and shoes ---
    ty = by + 7
    if step == 0:
        rect(d, 5, ty, 6, ty + 5, NAVY); rect(d, 9, ty, 10, ty + 5, NAVY)
        rect(d, 5, ty + 6, 6, ty + 6, SHOE); rect(d, 9, ty + 6, 10, ty + 6, SHOE)
    else:
        a, b = (5, 9) if step == 1 else (9, 5)
        rect(d, a, ty, a + 1, ty + 5, NAVY)          # leg forward
        rect(d, b, ty, b + 1, ty + 4, NAVY)          # leg back, lifted
        rect(d, a, ty + 6, a + 1, ty + 6, SHOE); rect(d, b, ty + 5, b + 1, ty + 5, SHOE)
    # tail (ginger, a ring), visible except from the front
    if facing == "up":
        rect(d, 11, by + 3, 13, by + 3, FUR); px(d, 13, by + 2, FUR_D)
    elif facing == "left":
        rect(d, 11, by + 4, 13, by + 4, FUR); px(d, 13, by + 3, FUR_D)
    elif facing == "right":
        rect(d, 2, by + 4, 4, by + 4, FUR); px(d, 2, by + 3, FUR_D)
    # --- the flute, raised ---
    if flute:
        if facing == "down":
            rect(d, 3, y0 + 6, 12, y0 + 6, FLUTE); px(d, 5, y0 + 6, KEY); px(d, 9, y0 + 6, KEY)
            rect(d, 4, by + 1, 4, by + 1, FUR); rect(d, 11, by + 1, 11, by + 1, FUR)
        elif facing == "up":
            rect(d, 3, y0 + 5, 12, y0 + 5, FLUTE)
        elif facing == "left":
            rect(d, 0, y0 + 6, 7, y0 + 6, FLUTE); px(d, 2, y0 + 6, KEY); px(d, 5, y0 + 6, KEY)
            px(d, 3, y0 + 7, FUR)
        else:
            rect(d, 8, y0 + 6, 15, y0 + 6, FLUTE); px(d, 10, y0 + 6, KEY); px(d, 13, y0 + 6, KEY)
            px(d, 12, y0 + 7, FUR)
    return im


def main():
    rows = ["down", "up", "left", "right"]
    sheet = Image.new("RGBA", (FW * 4, FH * 4), (0, 0, 0, 0))
    for r, facing in enumerate(rows):
        for c, (step, flute) in enumerate([(0, False), (1, False), (2, False), (0, True)]):
            sheet.paste(frame(facing, step, flute), (c * FW, r * FH))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT)
    meta = OUT.with_suffix(".json")
    meta.write_text('{"fw": %d, "fh": %d, "rows": {"down": 0, "up": 1, "left": 2, "right": 3}, "cols": {"idle": 0, "walk": [1, 2], "flute": 3}, "_readme": "GENERATED by betatest/tools/randy_biped.py; the production art from the Flutie Cats asset route replaces this file for file."}\n' % (FW, FH), encoding="utf-8")
    print("wrote", OUT, sheet.size)


if __name__ == "__main__":
    main()
