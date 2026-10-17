"""Baut speisekarte.html aus data/menu.json.

Logo-Leiste und Footer werden aus index.html übernommen, damit beide Seiten gleich aussehen.
Aufruf (im Projektordner): python3 tools/build_menu.py
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
menu = json.loads((ROOT / "data/menu.json").read_text(encoding="utf-8"))
index = (ROOT / "index.html").read_text(encoding="utf-8")

# Bilder für Kategorien, zu denen es ein passendes Foto gibt
KATEGORIE_BILD = {
    "Pizza": "assets/img/dishes/pizza.webp",
    "Döner": "assets/img/dishes/doener.webp",
    "Lahmacun": "assets/img/dishes/lahmacun.webp",
    "Getränke": "assets/img/icons/cola.webp",
}


def esc(s):
    return html.escape(str(s), quote=True)


def slug(s):
    s = s.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def euro(n):
    return f"{n:.2f}".replace(".", ",") + " €"


def codes(item):
    raw = item.get("allergene", "")
    if not raw:
        return ""
    parts = [c.strip() for c in raw.split(",") if c.strip()]
    names = []
    for c in parts:
        names.append(menu["allergene"].get(c) or menu["zusatzstoffe"].get(c) or c)
    return f'<sup class="codes" title="{esc(", ".join(names))}">{esc(", ".join(parts))}</sup>'


def item_html(item, sizes):
    name = item["name"]
    desc = item.get("beschreibung", "")
    if sizes and "preise" in item:
        prices = "".join(f'<span class="price"><small>{esc(s)}</small>{euro(item["preise"][s])}</span>' for s in sizes)
    else:
        prices = f'<span class="price">{euro(item["preis"])}</span>'
    pfand = ' <span class="pfand">zzgl. Pfand</span>' if item.get("pfand") else ""
    return (
        '<li class="item">'
        f'<span class="item__nr">{esc(item["nr"])}</span>'
        '<div class="item__main">'
        f'<h3 class="item__name">{esc(name)}{codes(item)}{pfand}</h3>'
        + (f'<p class="item__desc">{esc(desc)}</p>' if desc else "")
        + "</div>"
        f'<div class="item__prices">{prices}</div>'
        "</li>"
    )


def section_html(cat):
    name = cat["kategorie"]
    sizes = cat.get("groessen", [])
    img = KATEGORIE_BILD.get(name)
    head_sizes = ""
    if sizes:
        head_sizes = '<div class="cat__sizes">' + "".join(f"<span>{esc(s)}</span>" for s in sizes) + "</div>"
    return (
        f'<section class="cat" id="{slug(name)}" aria-labelledby="h-{slug(name)}">'
        '<header class="cat__head">'
        + (f'<img class="cat__img" src="{img}" alt="" loading="lazy">' if img else "")
        + f'<h2 id="h-{slug(name)}">{esc(name)}</h2>'
        + head_sizes
        + "</header>"
        '<ul class="items">' + "".join(item_html(i, sizes) for i in cat["artikel"]) + "</ul>"
        "</section>"
    )


def legend_html():
    zs = "".join(f"<li><b>{esc(k)}</b> {esc(v)}</li>" for k, v in menu["zusatzstoffe"].items())
    al = "".join(f"<li><b>{esc(k)}</b> {esc(v)}</li>" for k, v in menu["allergene"].items())
    hints = "".join(f"<p>{esc(h)}</p>" for h in menu["hinweise"])
    return (
        '<section class="legend" id="allergene" aria-labelledby="h-allergene">'
        '<h2 id="h-allergene">Allergene und Zusatzstoffe</h2>'
        '<div class="legend__cols">'
        f'<div><h3>Zusatzstoffe</h3><ul>{zs}</ul></div>'
        f'<div><h3>Allergene (enthält …)</h3><ul>{al}</ul></div>'
        "</div>"
        f"{hints}"
        "</section>"
    )


head = index[: index.index("<body>")]
head = re.sub(r"<title>.*?</title>", "<title>Speisekarte – Neusser Döner &amp; Pizza</title>", head, flags=re.S)
head = re.sub(
    r'<meta name="description" content="[^"]*">',
    '<meta name="description" content="Speisekarte von Neusser Döner &amp; Pizza in Neuss: Pizza, Döner, Lahmacun, Pide, '
    'Burger, Schnitzel, Menüs und Getränke mit Preisen und Allergenen.">',
    head,
)
topbar = index[index.index("  <!-- Logo-Leiste -->"): index.index("  <!-- Angebote:")]
footer = index[index.index("  <!-- Kontakt, Öffnungszeiten, Impressum -->"): index.index("  <script")]
topbar = topbar.replace('href="#angebote-liste"', 'href="index.html#angebote-liste"').replace(
    'href="#kontakt"', 'href="#kontakt"'
)

cats = menu["kategorien"]
nav = "".join(f'<a href="#{slug(c["kategorie"])}">{esc(c["kategorie"])}</a>' for c in cats)
nav += '<a href="#allergene">Allergene</a>'

page = f"""{head}<body class="page-menu">

{topbar}
  <main>
    <section class="menu-hero">
      <div class="container menu-hero__inner">
        <h1>Speisekarte</h1>
        <p>{sum(len(c["artikel"]) for c in cats)} Gerichte und Getränke · Lieferung ab 10&nbsp;€ Bestellwert · frei Haus ab 50&nbsp;€</p>
        <a class="btn btn--primary" href="https://neusser-doener-pizza.de/bestellen">Jetzt bestellen</a>
      </div>
    </section>

    <nav class="cat-nav" aria-label="Kategorien">
      <div class="container cat-nav__inner">{nav}</div>
    </nav>

    <div class="container menu">
      {"".join(section_html(c) for c in cats)}
      {legend_html()}
    </div>
  </main>

{footer}  <script src="assets/js/menu.js" defer></script>
</body>
</html>
"""
(ROOT / "speisekarte.html").write_text(page, encoding="utf-8")
print("speisekarte.html:", len(cats), "Kategorien,", sum(len(c["artikel"]) for c in cats), "Artikel")
