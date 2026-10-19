"""Dönerspieß im Logo rundum drehen lassen.

1. python3 tools/blender/spiess_vorbereiten.py           → Umriss (profil.json) und Rundum-Textur aus
                                                            assets/img/logo/spiess.webp
2. python tools/blender/spiess_render.py (mit bpy)        → 24 Einzelbilder in tools/blender/spiess/frames
3. python3 tools/blender/spiess_vorbereiten.py --blatt   → assets/img/logo/spiess-dreh.webp (Bildstreifen)
"""
import json
import math
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent
ARB = Path(__file__).resolve().parent / "spiess"
ARB.mkdir(exist_ok=True)
N = 24


def vorbereiten():
    im = Image.open(ROOT / "assets/img/logo/spiess.webp").convert("RGBA")
    W, H = im.size
    px = im.load()

    def ok(p):
        r, g, b, a = p
        return a > 160 and (0.3 * r + 0.59 * g + 0.11 * b) < 215   # helle Flammenreste zählen nicht

    rows = {}
    for y in range(H):
        xs = [x for x in range(W) if ok(px[x, y])]
        if len(xs) >= 2:
            rows[y] = (min(xs), max(xs))
    yb = max(y for y in rows if y <= 150)
    fleisch = [y for y in rows if rows[y][1] - rows[y][0] > 30 and y <= yb]
    # Mittellinie c(y) = a + b·y – der Spieß steht im Logo leicht schräg
    n = len(fleisch)
    my = sum(fleisch) / n
    mc = sum((rows[y][0] + rows[y][1]) / 2 for y in fleisch) / n
    b = sum((y - my) * ((rows[y][0] + rows[y][1]) / 2 - mc) for y in fleisch) / sum((y - my) ** 2 for y in fleisch)
    a = mc - b * my
    breite = {y: (rows[y][1] - rows[y][0]) / 2 for y in rows if y <= yb}
    glatt = {}
    for y in breite:
        fenster = sorted(breite[t] for t in range(y - 2, y + 3) if t in breite)
        glatt[y] = fenster[len(fenster) // 2]
    # Zeilen auffüllen: Lücken bekommen das nächste gültige Pixel derselben Zeile
    voll = {}
    for y in rows:
        l, r = rows[y]
        gut = [x for x in range(l, r + 1) if ok(px[x, y])]
        voll[y] = [px[min(gut, key=lambda g: abs(g - x)), y][:3] for x in range(W)]
    TW = 512
    tex = Image.new("RGB", (TW, H))
    tp = tex.load()
    zeilen = sorted(voll)
    for y in range(H):
        yy = y if y in voll else min(zeilen, key=lambda k: abs(k - y))
        c = a + b * yy if rows[yy][1] - rows[yy][0] > 12 else (rows[yy][0] + rows[yy][1]) / 2
        w = glatt.get(yy, (rows[yy][1] - rows[yy][0]) / 2)
        for u in range(TW):
            x = c + 0.8 * w * math.sin(2 * math.pi * u / TW)   # Vorderseite rundum, Rückseite gespiegelt
            x0 = int(max(0, min(W - 2, x)))
            f = x - x0
            p0, p1 = voll[yy][x0], voll[yy][x0 + 1]
            tp[u, y] = tuple(int(p0[i] * (1 - f) + p1[i] * f) for i in range(3))
    tex.save(ARB / "textur.png")
    json.dump({"W": W, "H": H, "yb": yb, "cb": a + b * yb, "tilt": math.atan(-b),
               "prof": [[y, glatt[y], 0] for y in sorted(glatt)]}, open(ARB / "profil.json", "w"))
    print("Profil und Textur geschrieben nach", ARB)


def blatt():
    bilder = [Image.open(ARB / f"frames/f{k:02d}.png").convert("RGBA") for k in range(N)]
    h = 128
    w = round(bilder[0].width * h / bilder[0].height)
    out = Image.new("RGBA", (w * N, h))
    for k, f in enumerate(bilder):
        f = f.resize((w, h), Image.LANCZOS)
        p = f.load()
        for y in range(h):   # Rundung: Ränder dunkler, Mitte etwas heller
            xs = [x for x in range(w) if p[x, y][3] > 20]
            if not xs:
                continue
            l, r = min(xs), max(xs)
            for x in range(l, r + 1):
                t = (x - l) / max(1, r - l) * 2 - 1
                s = 1 - 0.42 * abs(t) ** 2.2 + 0.08 * (1 - abs(t))
                R, G, B, A = p[x, y]
                p[x, y] = (min(255, int(R * s)), min(255, int(G * s)), min(255, int(B * s)), A)
        out.paste(f, (k * w, 0))
    out.save(ROOT / "assets/img/logo/spiess-dreh.webp", quality=86, method=6)
    print("geschrieben: assets/img/logo/spiess-dreh.webp")


if __name__ == "__main__":
    blatt() if "--blatt" in sys.argv else vorbereiten()
