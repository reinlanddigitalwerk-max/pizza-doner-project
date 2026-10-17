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


# Bild je Artikel (Nummer → Datei in assets/img/menu/). Fotos sind Beispielbilder.
BILD = {
    "38": "pizza-margherita", "39": "pizza-salami", "40": "pizza-schinken", "41": "pizza-funghi",
    "42": "pizza-tonno", "43": "pizza-hawaii", "44": "pizza-diavolo", "45": "pizza-sucuk",
    "46": "pizza-salami", "47": "pizza-paprika", "48": "pizza-spinat", "49": "pizza-vegetaria",
    "50": "pizza-nepal", "51": "pizza-sucuk", "52": "pizza-quattro-stagioni", "53": "pizza-chicken",
    "54": "pizza-bbq-chicken", "55": "pizza-chicken", "56": "pizza-quattro-formaggi", "57": "calzone",
    "19": "salat-gemischt", "20": "salat-doener", "21": "salat-thunfisch", "22": "salat-bauern",
    "17": "salat-tasche", "18": "salat-wrap",
    "1": "doener-sandwich", "2": "doener-sandwich", "3": "doener-wrap", "4": "doener-fleisch",
    "5": "doener-teller", "6": "doener-box", "7": "doener-box", "8": "doener-reis",
    "9": "doener-ueberbacken", "10": "doener-ueberbacken",
    "11": "lahmacun", "12": "lahmacun-salat", "13": "lahmacun-salat",
    "14": "falafel-sandwich", "15": "falafel-wrap", "16": "falafel-teller",
    "23": "pide", "24": "pide", "25": "pide", "26": "pide", "27": "pide",
    "58": "schnitzel", "59": "jaegerschnitzel", "60": "paprikaschnitzel",
    "28": "hamburger", "29": "cheeseburger", "30": "chili-cheeseburger", "31": "chickenburger", "32": "chickenburger",
    "33": "pizzabroetchen", "34": "pizzabroetchen", "35": "pizzabroetchen", "36": "pizzabroetchen", "37": "pizzabroetchen",
    "63": "chicken-nuggets", "64": "currywurst", "65": "currywurst-pommes", "66": "currywurst-pommes",
    "67": "chicken-bowl", "61": "pommes", "62": "reis", "62a": "peperoni", "62b": "oliven",
    "S1": "ketchup", "S2": "mayonnaise", "S3": "tzatziki", "S4": "cocktailsauce", "S5": "currysauce",
    "S6": "pilzsauce", "S7": "paprikasauce", "S8": "scharfe-sauce", "S9": "aioli", "S10": "kraeuterbutter",
    "M1": "doener-sandwich", "M2": "doener-wrap-menue", "M3": "lahmacun-salat", "M4": "falafel-sandwich",
    "K1": "kinder-menue",
    "68a": "cola", "68b": "orangenlimonade", "68c": "zitronenlimonade", "68d": "zitronenlimonade",
    "68e": "cola", "70": "wasser", "71": "ayran", "72": "eistee",
}


def zutaten(item):
    """Zutaten als Liste aus der Beschreibung der alten Seite (nichts dazu erfunden)."""
    d = item.get("beschreibung", "")
    if not d or d.startswith("Literpreis") or d.startswith("auf Wunsch"):
        m = re.search(r" mit (.+)$", item["name"])
        return [m.group(1)] if m and not d.startswith("Literpreis") else []
    d = d.replace("Ihrer Wahl", "nach Wahl").replace("einer Sauce", "Sauce").replace("(0,33l)", "(0,33 l)")
    d = re.sub(r"^nur ", "", d)
    d = d.replace("panierten, frittierten Chicken-Stripes", "Chicken-Stripes (paniert, frittiert)")
    first = []
    if " mit " in d and not d.startswith("mit "):
        head, d = d.split(" mit ", 1)
        first = [head[0].upper() + head[1:]]
    d = re.sub(r"^mit ", "", d)
    d = d.replace(" dazu,", ",").replace(", dazu ", ", ").replace(" und ", ", ")
    parts = [p.strip() for p in re.split(r",(?![^()]*\))", d) if p.strip()]
    return first + [p[0].upper() + p[1:] if p[0].islower() and not p.startswith(("frisch", "türk", "paniert")) else p for p in parts]


def info(item):
    d = item.get("beschreibung", "")
    if d.startswith("Literpreis"):
        return d.replace("Literpreis:", "Literpreis").replace("Pfand:", "Pfand").replace(".", ",").replace("€", "\u00a0€")
    if d.startswith("auf Wunsch"):
        return d[0].upper() + d[1:]
    return ""


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


def allergen_namen(item):
    raw = item.get("allergene", "")
    parts = [c.strip() for c in raw.split(",") if c.strip()]
    al = [menu["allergene"][c] for c in parts if c in menu["allergene"]]
    zs = [menu["zusatzstoffe"][c] for c in parts if c in menu["zusatzstoffe"]]
    return al, zs


def item_html(item, sizes, basis=(), kategorie=""):
    name = item["name"]
    if sizes and "preise" in item:
        prices = "".join(f'<span class="price"><small>{esc(s)}</small>{euro(item["preise"][s])}</span>' for s in sizes)
    else:
        prices = f'<span class="price">{euro(item["preis"])}</span>'
    pfand = '<span class="pfand">zzgl. Pfand</span>' if item.get("pfand") else ""
    z = zutaten(item)
    base = [b for b in basis if b not in z]
    chips = ('<ul class="chips">' + "".join(f'<li class="chip--basis">{esc(x)}</li>' for x in base)
             + "".join(f"<li>{esc(x)}</li>" for x in z) + "</ul>") if (z or base) else ""
    al, zs = allergen_namen(item)
    more = ""
    if al or zs:
        more = ('<div class="card__more" hidden>'
                + (f'<p><b>Allergene:</b> {esc(", ".join(al))}</p>' if al else "")
                + (f'<p><b>Zusatzstoffe:</b> {esc(", ".join(zs))}</p>' if zs else "")
                + "</div>")
    search = " ".join([name, kategorie, item["nr"]] + list(base) + z).lower()
    note = f'<p class="card__info">{esc(info(item))}</p>' if info(item) else ""
    key = BILD.get(item["nr"])
    has_img = key and (ROOT / f"assets/img/menu/{key}.webp").exists()
    img = (f'<img class="card__img" src="assets/img/menu/{key}.webp" alt="" width="192" height="192" loading="lazy"'
           f' data-large="assets/img/menu/{key}-l.webp">'
           if has_img else '<span class="card__img card__img--none"></span>')
    return (
        f'<li class="card" data-search="{esc(search)}">'
        f"{img}"
        '<div class="card__body">'
        f'<h3 class="card__name"><span class="card__nr">{esc(item["nr"])}</span>{esc(name)}{codes(item)}</h3>'
        f"{chips}{note}"
        f'<div class="card__foot">{pfand}<div class="card__prices">{prices}</div></div>'
        "</div>"
        f"{more}"
        f'<button class="card__open" type="button" aria-label="Details zu {esc(name)}"></button>'
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
        + (f'<p class="cat__note">{esc(cat["hinweis"])}</p>' if cat.get("hinweis") else "")
        + '<ul class="cards">' + "".join(item_html(i, sizes, cat.get("basis", []), name) for i in cat["artikel"]) + "</ul>"
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

    <div class="cat-nav">
      <div class="container cat-nav__wrap">
        <div class="search">
          <label class="visually-hidden" for="menu-search">Speisekarte durchsuchen</label>
          <input id="menu-search" type="search" placeholder="Gericht oder Zutat suchen …" autocomplete="off">
        </div>
        <nav class="cat-nav__inner" aria-label="Kategorien">{nav}</nav>
      </div>
    </div>

    <div class="container menu">
      <p class="search-empty" hidden>Nichts gefunden. Versuch es mit einem anderen Wort, z. B. „Käse“ oder „Hähnchen“.</p>
      <p class="search-count" aria-live="polite"></p>
      {"".join(section_html(c) for c in cats)}
      {legend_html()}
      <p class="menu__note">Abbildungen sind Beispielfotos und können vom Gericht abweichen.</p>
    </div>
  </main>

  <dialog class="dish-dialog" aria-labelledby="dish-dialog-title">
    <button class="dish-dialog__close" type="button" aria-label="Schließen">×</button>
    <img class="dish-dialog__img" src="" alt="">
    <div class="dish-dialog__body">
      <h2 id="dish-dialog-title"></h2>
      <div class="dish-dialog__content"></div>
      <a class="btn btn--primary" href="https://neusser-doener-pizza.de/bestellen">Jetzt bestellen</a>
    </div>
  </dialog>

{footer}  <script src="assets/js/menu.js" defer></script>
</body>
</html>
"""
(ROOT / "speisekarte.html").write_text(page, encoding="utf-8")
print("speisekarte.html:", len(cats), "Kategorien,", sum(len(c["artikel"]) for c in cats), "Artikel")
