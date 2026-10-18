"""Baut die Unterseiten aus den Daten in data/:

  speisekarte.html  – Speisekarte als Karten (data/menu.json)
  bestellen.html    – Bestellshop (Speisebaron) eingebettet
  ueber-uns.html    – Über uns, Kontakt, Öffnungs- und Lieferzeiten (data/shop.json)
  impressum.html    – Impressum (data/shop.json)
  datenschutz.html  – Datenschutzerklärung (data/quellen/datenschutz-shop.txt)

Logo-Leiste und Footer kommen aus index.html, damit alle Seiten gleich aussehen.
Aufruf (im Projektordner): python3 tools/build_pages.py
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
menu = json.loads((ROOT / "data/menu.json").read_text(encoding="utf-8"))
shop = json.loads((ROOT / "data/shop.json").read_text(encoding="utf-8"))
index = (ROOT / "index.html").read_text(encoding="utf-8")

# Foto je Gericht (Datei in assets/img/menu/). Zuordnung über die Nummer der alten Seite (alt_nr),
# neue Gerichte über den Namen. Ohne Treffer wird das Kategoriefoto gezeigt. Fotos sind Beispielbilder.
BILD_ALT = {
    "38": "pizza-margherita", "39": "pizza-salami", "40": "pizza-schinken", "41": "pizza-funghi",
    "42": "pizza-tonno", "43": "pizza-hawaii", "44": "pizza-diavolo", "45": "pizza-sucuk",
    "46": "pizza-salami", "47": "pizza-paprika", "48": "pizza-spinat", "49": "pizza-vegetaria",
    "50": "pizza-nepal", "51": "pizza-sucuk", "52": "pizza-quattro-stagioni", "53": "pizza-chicken",
    "54": "pizza-bbq-chicken", "55": "pizza-chicken", "56": "pizza-quattro-formaggi", "57": "calzone",
    "19": "salat-gemischt", "20": "salat-doener", "21": "salat-thunfisch", "22": "salat-bauern",
    "17": "salat-tasche", "18": "salat-wrap",
    "1": "doener-sandwich", "3": "doener-wrap", "4": "doener-fleisch",
    "5": "doener-teller", "6": "doener-box", "7": "doener-box", "8": "doener-reis", "9": "doener-ueberbacken",
    "11": "lahmacun", "12": "lahmacun-salat", "13": "lahmacun-salat",
    "14": "falafel-sandwich", "15": "falafel-wrap", "16": "falafel-teller",
    "23": "pide", "24": "pide", "25": "pide", "26": "pide", "27": "pide",
    "58": "schnitzel", "59": "jaegerschnitzel", "60": "paprikaschnitzel",
    "28": "hamburger", "29": "cheeseburger", "30": "chili-cheeseburger", "31": "chickenburger", "32": "chickenburger",
    "33": "pizzabroetchen", "34": "pizzabroetchen", "35": "pizzabroetchen", "36": "pizzabroetchen", "37": "pizzabroetchen",
    "63": "chicken-nuggets", "64": "currywurst", "65": "currywurst-pommes", "66": "currywurst-pommes",
    "61": "pommes", "62": "reis", "62a": "peperoni", "62b": "oliven",
    "S1": "ketchup", "S2": "mayonnaise", "S3": "tzatziki", "S4": "cocktailsauce", "S5": "currysauce",
    "S6": "pilzsauce", "S7": "paprikasauce", "S8": "scharfe-sauce", "S9": "aioli", "S10": "kraeuterbutter",
    "M1": "doener-sandwich", "M2": "doener-wrap-menue", "M3": "lahmacun-salat", "M4": "falafel-sandwich",
    "K1": "kinder-menue",
    "68a": "cola", "68b": "orangenlimonade", "68d": "zitronenlimonade", "68e": "cola",
    "70": "wasser", "71": "ayran", "72": "eistee",
}
BILD_NAME = [
    (r"^Neusser Salat", "salat-gemischt"), (r"^(Coca Cola|Cola Zero|Mezzo Mix)", "cola"),
    (r"^Fanta", "orangenlimonade"), (r"^Sprite", "zitronenlimonade"),
]

ORDER_URL = "bestellen.html"


def esc(s):
    return html.escape(str(s), quote=True)


def slug(s):
    s = s.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def euro(n):
    return f"{n:.2f}".replace(".", ",") + " €"


# ---------- Zutaten aus der Beschreibung (nichts dazu erfunden) ----------
INFO_ONLY = re.compile(r"^(\d+\s*(er\s*)?Portion.*|von der Pute|natur, ohne alles)$", re.I)


def zutaten(item, basis=()):
    d = item.get("beschreibung", "")
    if not d or INFO_ONLY.match(d):
        return []
    d = re.sub(r"\s*zubereitet\.?$", "", d).rstrip(".")
    d = d.replace(" 1 Getränk", ", 1 Getränk").replace("Ihrer Wahl", "nach Wahl")
    d = re.sub(r"^(gefüllt|6 Stück)\s+", "", d)
    if not re.search(r"\bmit\b|,", d):
        return []
    first = []
    m = re.match(r"^(.+?),?\s+mit\s+(.+)$", d)
    if m and not d.startswith("mit "):
        first, d = [m.group(1).strip(" ,")], m.group(2)
    d = re.sub(r"^mit\s+", "", d)
    d = d.replace(" dazu ", ", ").replace(", dazu", ",").replace(" und ", ", ")
    parts = [p.strip(" .") for p in re.split(r",(?![^()]*\))", d) if p.strip(" .")]
    out = []
    for p in first + parts:
        p = p[0].upper() + p[1:] if p and p[0].islower() and not p.startswith(("frisch", "türk", "knusprig")) else p
        if p not in out and p not in basis:
            out.append(p)
    return out


def info(item):
    d = item.get("beschreibung", "")
    return d if d and INFO_ONLY.match(d) else ""


def allergen_namen(item):
    parts = [c.strip() for c in item.get("allergene", "").split(",") if c.strip()]
    al = [menu["allergene"][c] for c in parts if c in menu["allergene"]]
    zs = [menu["zusatzstoffe"][c] for c in parts if c in menu["zusatzstoffe"]]
    return parts, al, zs


def bild(item):
    key = BILD_ALT.get(item.get("alt_nr", ""))
    if not key:
        for pat, k in BILD_NAME:
            if re.search(pat, item["name"]):
                key = k
                break
    if key and (ROOT / f"assets/img/menu/{key}.webp").exists():
        return f"assets/img/menu/{key}.webp", f"assets/img/menu/{key}-l.webp"
    return None, None


def optionen_html(groups):
    if not groups:
        return ""
    out = ['<div class="card__opts" hidden><h4>Wünsche &amp; Extras beim Bestellen</h4>']
    for g in groups:
        ch = []
        for c in g["auswahl"]:
            preis = f' <span class="opt-price">+{euro(c["aufpreis"])}</span>' if c["aufpreis"] else ""
            ch.append(f"<li>{esc(c['name'])}{preis}</li>")
        out.append(f'<div class="opt-group"><p class="opt-title">{esc(g["titel"])}'
                   f'{" <small>(mehrere möglich)</small>" if g.get("mehrfach") else ""}</p><ul>{"".join(ch)}</ul></div>')
    out.append("</div>")
    return "".join(out)


def item_html(item, cat):
    name = item["name"]
    sizes = cat.get("groessen", [])
    basis = cat.get("basis", [])
    if "preise" in item:
        prices = "".join(f'<span class="price"><small>{esc(s)}</small>{euro(item["preise"][s])}</span>'
                         for s in sizes if s in item["preise"])
    else:
        prices = f'<span class="price">{euro(item["preis"])}</span>'
    z = zutaten(item, basis)
    base = list(basis)
    chips = ('<ul class="chips">' + "".join(f'<li class="chip--basis">{esc(x)}</li>' for x in base)
             + "".join(f"<li>{esc(x)}</li>" for x in z) + "</ul>") if (z or base) else ""
    note = f'<p class="card__info">{esc(info(item))}</p>' if info(item) else ""
    codes, al, zs = allergen_namen(item)
    sup = f'<sup class="codes" title="{esc(", ".join(al + zs))}">{esc(", ".join(codes))}</sup>' if codes else ""
    more = ""
    if al or zs:
        more = ('<div class="card__more" hidden>'
                + (f'<p><b>Allergene:</b> {esc(", ".join(al))}</p>' if al else "")
                + (f'<p><b>Zusatzstoffe:</b> {esc(", ".join(zs))}</p>' if zs else "")
                + "</div>")
    groups = list(cat.get("optionen", [])) + list(item.get("optionen", []))
    extras = any(c["aufpreis"] for g in groups for c in g["auswahl"])
    hint = '<span class="card__extras">Extras möglich</span>' if extras else ""
    small, large = bild(item)
    if not small and cat.get("bild"):
        small = large = cat["bild"]
    img = (f'<img class="card__img" src="{small}" alt="" width="192" height="192" loading="lazy" data-large="{large}">'
           if small else '<span class="card__img card__img--none"></span>')
    search = " ".join([name, cat["kategorie"], item.get("nr", "")] + base + z
                      + [c["name"] for g in groups for c in g["auswahl"] if c["aufpreis"]]).lower()
    nr = f'<span class="card__nr">{esc(item["nr"])}</span>' if item.get("nr") else ""
    return (
        f'<li class="card" data-search="{esc(search)}">'
        f"{img}"
        '<div class="card__body">'
        f'<h3 class="card__name">{nr}{esc(name)}{sup}</h3>'
        f"{chips}{note}"
        f'<div class="card__foot">{hint}<div class="card__prices">{prices}</div></div>'
        "</div>"
        f"{more}{optionen_html(groups)}"
        f'<button class="card__open" type="button" aria-label="Details zu {esc(name)}"></button>'
        "</li>"
    )


def section_html(cat):
    items = [a for a in cat["artikel"] if a.get("aktiv", True)]
    if not items:
        return ""
    name = cat["kategorie"]
    img = cat.get("bild")
    note = cat.get("hinweis") or cat.get("beschreibung")
    return (
        f'<section class="cat" id="{slug(name)}" aria-labelledby="h-{slug(name)}">'
        '<header class="cat__head">'
        + (f'<img class="cat__img" src="{img}" alt="" loading="lazy">' if img else "")
        + f'<h2 id="h-{slug(name)}">{esc(name)}</h2>'
        + "</header>"
        + (f'<p class="cat__note">{esc(note)}</p>' if note else "")
        + '<ul class="cards">' + "".join(item_html(i, cat) for i in items) + "</ul>"
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


# ---------- Rahmen aus index.html ----------
HEAD = index[: index.index("<body>")]
TOPBAR = index[index.index("  <!-- Logo-Leiste -->"): index.index("  <!-- Angebote:")]
FOOTER = index[index.index("  <!-- Kontakt, Öffnungszeiten, Impressum -->"): index.index("  <script")]


def topbar(filename):
    """Logo-Leiste mit markiertem Menüpunkt der aktuellen Seite."""
    t = TOPBAR.replace(' aria-current="page"', "")
    return t.replace(f'<a href="{filename}">', f'<a href="{filename}" aria-current="page">', 1)


def page(filename, title, description, body, scripts="", body_class=""):
    head = re.sub(r"<title>.*?</title>", f"<title>{esc(title)}</title>", HEAD, flags=re.S)
    head = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{esc(description)}">', head)
    out = f"""{head}<body class="{body_class}">

{topbar(filename)}
  <main>
{body}
  </main>

{FOOTER}{scripts}</body>
</html>
"""
    (ROOT / filename).write_text(out, encoding="utf-8")
    print("geschrieben:", filename)


def page_hero(title, text="", cta=True):
    return f"""    <section class="menu-hero">
      <div class="container menu-hero__inner">
        <h1>{esc(title)}</h1>
        {f'<p>{text}</p>' if text else ''}
        {f'<a class="btn btn--primary" href="{ORDER_URL}">Jetzt bestellen</a>' if cta else ''}
      </div>
    </section>"""


# ---------- Speisekarte ----------
cats = [c for c in menu["kategorien"] if any(a.get("aktiv", True) for a in c["artikel"])]


# ---------- Startseite: Kategorien mit Foto (zwischen den Markierungen in index.html) ----------
def ab_preis(cat):
    p = [v for a in cat["artikel"] if a.get("aktiv", True)
         for v in ([a["preis"]] if "preis" in a else a.get("preise", {}).values())]
    return min(p) if p else None


def kat_kachel(cat):
    items = [a for a in cat["artikel"] if a.get("aktiv", True)]
    img = cat.get("bild") or next((b for b, _ in map(bild, items) if b), "")
    preis = ab_preis(cat)
    n = len(items)
    return (
        f'<li><a class="cat-tile" href="speisekarte.html#{slug(cat["kategorie"])}">'
        + (f'<img src="{img}" alt="" loading="lazy" width="400" height="300">' if img else "")
        + f'<span class="cat-tile__name">{esc(cat["kategorie"])}</span>'
        + f'<span class="cat-tile__meta">{n} {"Gericht" if n == 1 else "Gerichte"}'
        + (f" · ab {euro(preis)}" if preis else "") + "</span></a></li>"
    )


START, END = "<!-- KATEGORIEN:START – wird von tools/build_pages.py erzeugt -->", "        <!-- KATEGORIEN:END -->"
grid = '\n        <ul class="cat-grid">\n          ' + "\n          ".join(kat_kachel(c) for c in cats) + "\n        </ul>\n"
i, j = index.index(START) + len(START), index.index(END)
index = index[:i] + grid + index[j:]
(ROOT / "index.html").write_text(index, encoding="utf-8")
print("geschrieben: index.html (Kategorien)")
n_items = sum(1 for c in cats for a in c["artikel"] if a.get("aktiv", True))
nav = "".join(f'<a href="#{slug(c["kategorie"])}">{esc(c["kategorie"])}</a>' for c in cats) + '<a href="#allergene">Allergene</a>'
page(
    "speisekarte.html",
    "Speisekarte – Neusser Döner & Pizza",
    "Speisekarte von Neusser Döner & Pizza in Neuss: Pizza, Döner, Lahmacun, Pide, Burger, Schnitzel, Menüs und Getränke mit Preisen, Extras und Allergenen.",
    f"""{page_hero("Speisekarte", f"{n_items} Gerichte und Getränke · Mindestbestellwert 10&nbsp;€ · bis 2&nbsp;km kostenlose Lieferung")}

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
      <p class="menu__note">Abbildungen sind Beispielfotos und können vom Gericht abweichen. Preise in Euro inkl. MwSt.</p>
    </div>

    <dialog class="dish-dialog" aria-labelledby="dish-dialog-title">
      <button class="dish-dialog__close" type="button" aria-label="Schließen">×</button>
      <img class="dish-dialog__img" src="" alt="">
      <div class="dish-dialog__body">
        <h2 id="dish-dialog-title"></h2>
        <div class="dish-dialog__content"></div>
        <a class="btn btn--primary" href="{ORDER_URL}">Jetzt bestellen</a>
      </div>
    </dialog>""",
    '  <script src="assets/js/menu.js" defer></script>\n',
    "page-menu",
)

# ---------- Bestellen (Shop eingebettet) ----------
page(
    "bestellen.html",
    "Online bestellen – Neusser Döner & Pizza",
    "Bei Neusser Döner & Pizza online bestellen: Lieferung in Neuss oder Abholung in der Further Straße 46.",
    f"""    <section class="order-head">
      <div class="container order-head__inner">
        <h1>Online bestellen</h1>
        <ul class="order-facts">
          <li><strong>Abholung</strong> in ca. {shop["lieferung"]["abholung_bereit_in_min"]} Min.</li>
          <li><strong>Lieferung</strong> in ca. {shop["lieferung"]["bereit_in_min"]} Min., {shop["lieferzeiten"]["Dienstag"][0]}–{shop["lieferzeiten"]["Dienstag"][1]} Uhr</li>
          <li><strong>bis 2&nbsp;km</strong> kostenlos · <strong>2–5&nbsp;km</strong> 2&nbsp;€ · Mindestbestellwert 10&nbsp;€</li>
          <li><strong>Bezahlen</strong> bar oder mit PayPal</li>
        </ul>
      </div>
    </section>
    <section class="order-frame">
      <div class="container">
        <iframe class="shop-frame" src="{shop["bestellen_url"]}" title="Bestellshop Neusser Döner &amp; Pizza" loading="eager" allow="payment"></iframe>
        <p class="order-note">Der Shop wird nicht angezeigt? <a href="{shop["bestellen_url"]}" target="_blank" rel="noopener">Bestellshop in neuem Fenster öffnen</a> oder anrufen: <a href="tel:{shop["telefon_link"]}">{esc(shop["telefon"])}</a></p>
      </div>
    </section>""",
    body_class="page-order",
)

# ---------- Über uns & Kontakt ----------
def zeiten_tabelle(z):
    rows = []
    for tag, v in z.items():
        rows.append(f'<tr><th scope="row">{tag}</th><td>{"Ruhetag" if not v else v[0] + " – " + v[1] + " Uhr"}</td></tr>')
    return '<table class="hours hours--light">' + "".join(rows) + "</table>"


about = "".join(f"<p>{esc(p)}</p>" for p in shop["ueber_uns"].split("\n") if p.strip())
merkmale = "".join(f"<li>{esc(m)}</li>" for m in shop["merkmale"])
zonen = "".join(
    f'<tr><th scope="row">{esc(z["name"])}</th><td>{"kostenlos" if not z["liefergebuehr"] else euro(z["liefergebuehr"]) + " Liefergebühr"} · ab {euro(z["mindestbestellwert"])}</td></tr>'
    for z in shop["lieferung"]["zonen"])
adr = shop["adresse"]
maps = "https://www.google.com/maps/search/?api=1&query=" + html.escape(f'{shop["name"]}, {adr["strasse"]}, {adr["plz"]} {adr["ort"]}').replace(" ", "+")
osm = f'https://www.openstreetmap.org/?mlat={shop["koordinaten"]["lat"]}&mlon={shop["koordinaten"]["lng"]}#map=17/{shop["koordinaten"]["lat"]}/{shop["koordinaten"]["lng"]}'
page(
    "ueber-uns.html",
    "Über uns & Kontakt – Neusser Döner & Pizza",
    "Neusser Döner & Pizza, Further Straße 46 in Neuss: Öffnungszeiten, Lieferzeiten, Liefergebiete und Kontakt.",
    f"""{page_hero("Über uns & Kontakt", "Türkische und italienische Küche in der Further Straße – zum Mitnehmen, zum Hieressen und mit Lieferservice.")}
    <div class="container info-page">
      <section class="info-card info-card--wide">
        <h2>Über uns</h2>
        {about}
        <ul class="tags">{merkmale}</ul>
      </section>
      <section class="info-card" id="kontakt-daten">
        <h2>Kontakt</h2>
        <address>
          {esc(shop["name"])}<br>
          {esc(adr["strasse"])}<br>
          {esc(adr["plz"])} {esc(adr["ort"])}
        </address>
        <p>Telefon: <a href="tel:{shop["telefon_link"]}">{esc(shop["telefon"])}</a></p>
        <p class="info-links"><a class="btn btn--small btn--outline" href="{maps}" target="_blank" rel="noopener">In Google Maps öffnen</a>
        <a class="btn btn--small btn--outline" href="{osm}" target="_blank" rel="noopener">In OpenStreetMap öffnen</a></p>
        <p>Bezahlen: {esc(", ".join(shop["zahlung"]))}</p>
      </section>
      <section class="info-card">
        <h2>Öffnungszeiten</h2>
        {zeiten_tabelle(shop["oeffnungszeiten"])}
      </section>
      <section class="info-card">
        <h2>Lieferzeiten</h2>
        {zeiten_tabelle(shop["lieferzeiten"])}
      </section>
      <section class="info-card">
        <h2>Liefergebiete</h2>
        <table class="hours hours--light">{zonen}</table>
        <p class="muted">Entfernung ab Further Straße 46. Lieferung in ca. {shop["lieferung"]["bereit_in_min"]} Minuten, Abholung in ca. {shop["lieferung"]["abholung_bereit_in_min"]} Minuten.</p>
      </section>
    </div>""",
    body_class="page-info",
)

# ---------- Impressum ----------
page(
    "impressum.html",
    "Impressum – Neusser Döner & Pizza",
    "Impressum von Neusser Döner & Pizza, Further Straße 46, 41462 Neuss.",
    f"""{page_hero("Impressum", cta=False)}
    <div class="container legal">
      <h2>Angaben gemäß § 5 DDG</h2>
      <p>{esc(shop["name"])}<br>Inhaber: {esc(shop["inhaber"])}<br>{esc(adr["strasse"])}<br>{esc(adr["plz"])} {esc(adr["ort"])}</p>
      <h2>Kontakt</h2>
      <p>Telefon: <a href="tel:{shop["telefon_link"]}">{esc(shop["telefon"])}</a></p>
      <h2>Umsatzsteuer</h2>
      <p>Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz: {esc(shop["ust_idnr"])}</p>
      <h2>Zuständige Aufsichtsbehörde</h2>
      <p>{esc(shop["aufsichtsbehoerde"])}</p>
      <h2>Verantwortlich für den Inhalt</h2>
      <p>{esc(shop["inhaber"])}, Anschrift wie oben</p>
      <h2>Online-Bestellungen</h2>
      <p>Der Bestellshop auf der Seite „Online bestellen“ wird von Speisebaron bereitgestellt (speisebaron.de).</p>
      <h2>Streitschlichtung</h2>
      <p>Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: <a href="https://ec.europa.eu/consumers/odr">https://ec.europa.eu/consumers/odr</a>.</p>
      <p>Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
      <h2>Haftung für Inhalte</h2>
      <p>Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Wir sind jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.</p>
      <h2>Haftung für Links</h2>
      <p>Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Links umgehend entfernen.</p>
      <h2>Urheberrecht</h2>
      <p>Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers. Soweit die Inhalte auf dieser Seite nicht vom Betreiber erstellt wurden, werden die Urheberrechte Dritter beachtet. Bildnachweise stehen im Fuß der Seite.</p>
    </div>""",
    body_class="page-legal",
)

# ---------- Datenschutz ----------
def datenschutz_html():
    raw = (ROOT / "data/quellen/datenschutz-shop.txt").read_text(encoding="utf-8")
    lines = [l.strip() for l in raw.split("\n")]
    out = []
    for l in lines[1:]:
        if not l:
            continue
        if re.match(r"^\d+\.\s", l) and len(l) < 90:
            out.append(f"<h2>{esc(l)}</h2>")
        elif len(l) < 80 and not l.endswith((".", ":", ")", ";")) and not l.startswith(("http", "-", "•")):
            out.append(f"<h3>{esc(l)}</h3>")
        else:
            t = esc(l)
            t = re.sub(r"(https?://[^\s<]+[^\s<.,;)])", r'<a href="\1">\1</a>', t)
            out.append(f"<p>{t}</p>")
    return "\n      ".join(out)


page(
    "datenschutz.html",
    "Datenschutz – Neusser Döner & Pizza",
    "Datenschutzerklärung von Neusser Döner & Pizza.",
    f"""{page_hero("Datenschutzerklärung", cta=False)}
    <div class="container legal">
      {datenschutz_html()}
    </div>""",
    body_class="page-legal",
)
