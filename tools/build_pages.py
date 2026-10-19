"""Baut die Unterseiten aus den Daten in data/:

  speisekarte.html  – Speisekarte zum Bestellen mit Warenkorb (data/menu.json)
  kasse.html        – Kasse: Formular, Absenden an die Datenbank oder per WhatsApp
  bestellungen.html – Bestell-Monitor für den Laden (nicht verlinkt)
  bestellen.html    – Bestellshop von Speisebaron eingebettet (Alternative mit PayPal)
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

ORDER_URL = "speisekarte.html"


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


def item_key(item, cat):
    return slug(cat["kategorie"]) + "--" + slug(item["name"])


def beschreibung(item, cat):
    """Kurztext für die Zeile: Zutaten oder Info, sonst die Beschreibung."""
    z = zutaten(item, cat.get("basis", []))
    if z:
        return ", ".join(z)
    return info(item) or item.get("beschreibung", "").rstrip(".")


def item_daten(item, cat):
    """Daten für Bestellfenster und Warenkorb (wird als JSON in die Seite geschrieben)."""
    codes, al, zs = allergen_namen(item)
    small, large = bild(item)
    if not small and cat.get("bild"):
        small = large = cat["bild"]
    d = {
        "name": item["name"],
        "kat": cat["kategorie"],
        "text": beschreibung(item, cat),
        "bild": large or "",
        "allergene": ", ".join(al),
        "zusatz": ", ".join(zs),
        "optionen": list(cat.get("optionen", [])) + list(item.get("optionen", [])),
    }
    if "preise" in item:
        d["preise"] = [[s, item["preise"][s]] for s in cat.get("groessen", item["preise"].keys()) if s in item["preise"]]
    else:
        d["preis"] = item["preis"]
    if cat.get("basis"):
        d["basis"] = ", ".join(cat["basis"])
    return d


def zeile_html(item, cat):
    """Eine Zeile wie bei Lieferando: Name, Zutaten, Preis, Foto rechts, Plus-Knopf."""
    key = item_key(item, cat)
    name = item["name"]
    if "preise" in item:
        preis = "ab " + euro(min(item["preise"].values()))
    else:
        preis = euro(item["preis"])
    codes, al, zs = allergen_namen(item)
    sup = f'<sup class="codes" title="{esc(", ".join(al + zs))}">{esc(", ".join(codes))}</sup>' if codes else ""
    small, _ = bild(item)
    if not small and cat.get("bild"):
        small = cat["bild"]
    img = f'<img class="meal__img" src="{small}" alt="" width="192" height="192" loading="lazy">' if small else ""
    groups = list(cat.get("optionen", [])) + list(item.get("optionen", []))
    extras = any(c["aufpreis"] for g in groups for c in g["auswahl"])
    text = beschreibung(item, cat)
    search = " ".join([name, cat["kategorie"], item.get("nr", ""), text]
                      + [c["name"] for g in groups for c in g["auswahl"] if c["aufpreis"]]).lower()
    return (
        f'<li class="meal" data-id="{key}" data-search="{esc(search)}">'
        '<div class="meal__text">'
        f'<h3 class="meal__name">{esc(name)}{sup}</h3>'
        + (f'<p class="meal__desc">{esc(text)}</p>' if text else "")
        + f'<p class="meal__price">{preis}{" <span>· Extras möglich</span>" if extras else ""}</p>'
        "</div>"
        f"{img}"
        f'<button class="meal__add" type="button" aria-label="{esc(name)} in den Warenkorb">'
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>'
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
        + f'<div><h2 id="h-{slug(name)}">{esc(name)}</h2>'
        + (f'<p class="cat__note">{esc(note.splitlines()[0])}</p>' if note else "")
        + "</div></header>"
        + '<ul class="meals">' + "".join(zeile_html(i, cat) for i in items) + "</ul>"
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
_f = index.index("  <!-- Kontakt, Öffnungszeiten, Impressum -->")
FOOTER = index[_f: index.index("  <script", _f)]


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
adr = shop["adresse"]


# ---------- Startseite: Kategorien mit Foto (zwischen den Markierungen in index.html) ----------
def ab_preis(cat):
    p = [v for a in cat["artikel"] if a.get("aktiv", True)
         for v in ([a["preis"]] if "preis" in a else a.get("preise", {}).values())]
    return min(p) if p else None


GROSS = ("pizza", "doener-drehspiess")  # große Kacheln, stehen vorne


def kat_kachel(cat):
    items = [a for a in cat["artikel"] if a.get("aktiv", True)]
    img = cat.get("bild") or next((l for _, l in map(bild, items) if l), "")
    preis = ab_preis(cat)
    n = len(items)
    gross = slug(cat["kategorie"]) in GROSS
    return (
        f'<li class="{"cat-cell cat-cell--big" if gross else "cat-cell"}"><a class="cat-tile" href="speisekarte.html#{slug(cat["kategorie"])}">'
        + (f'<img src="{img}" alt="" loading="lazy" width="400" height="300">' if img else "")
        + f'<span class="cat-tile__name">{esc(cat["kategorie"])}</span>'
        + f'<span class="cat-tile__meta">{n} {"Gericht" if n == 1 else "Gerichte"}'
        + (f" · ab {euro(preis)}" if preis else "") + "</span></a></li>"
    )


START, END = "<!-- KATEGORIEN:START – wird von tools/build_pages.py erzeugt -->", "        <!-- KATEGORIEN:END -->"
grid = '\n        <ul class="cat-grid">\n          ' + "\n          ".join(kat_kachel(c) for c in sorted(cats, key=lambda c: slug(c["kategorie"]) not in GROSS)) + "\n        </ul>\n"
i, j = index.index(START) + len(START), index.index(END)
index = index[:i] + grid + index[j:]
(ROOT / "index.html").write_text(index, encoding="utf-8")
print("geschrieben: index.html (Kategorien)")
n_items = sum(1 for c in cats for a in c["artikel"] if a.get("aktiv", True))
nav = "".join(f'<a href="#{slug(c["kategorie"])}">{esc(c["kategorie"])}</a>' for c in cats) + '<a href="#allergene">Allergene</a>'
# ---------- Daten für Warenkorb und Kasse (assets/js/shop-daten.js) ----------
gebiete = json.loads((ROOT / "data/liefergebiete.json").read_text(encoding="utf-8"))
shop_daten = {
    "name": shop["name"],
    "telefon": shop["telefon"],
    "telefonLink": shop["telefon_link"],
    "whatsapp": "49" + re.sub(r"\D", "", shop["telefon_mobil"]).lstrip("0"),
    "lieferungMin": shop["lieferung"]["bereit_in_min"],
    "abholungMin": shop["lieferung"]["abholung_bereit_in_min"],
    "mindestbestellwert": min(z["min"] for z in gebiete["zonen"]),
    "zonen": gebiete["zonen"],
}
(ROOT / "assets/js/shop-daten.js").write_text(
    "// Wird von tools/build_pages.py aus data/shop.json und data/liefergebiete.json erzeugt – nicht von Hand ändern.\n"
    "window.SHOP = " + json.dumps(shop_daten, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
print("geschrieben: assets/js/shop-daten.js")

menu_daten = {item_key(a, c): item_daten(a, c) for c in cats for a in c["artikel"] if a.get("aktiv", True)}
gratis = [z["plz"] for z in gebiete["zonen"] if not z["gebuehr"]]
SHOP_SCRIPTS = ('  <script src="assets/js/offers-data.js" defer></script>\n'
                '  <script src="assets/js/shop-daten.js" defer></script>\n'
                '  <script src="assets/js/bestell-config.js" defer></script>\n'
                '  <script src="assets/js/warenkorb.js" defer></script>\n')

page(
    "speisekarte.html",
    "Speisekarte & online bestellen – Neusser Döner & Pizza",
    "Speisekarte von Neusser Döner & Pizza in Neuss: Pizza, Döner, Lahmacun, Pide, Burger, Schnitzel, Menüs und Getränke – direkt online bestellen, liefern lassen oder abholen.",
    f"""    <section class="shop-head">
      <div class="container shop-head__inner">
        <img class="shop-head__logo" src="assets/img/logo.webp" alt="" width="560" height="375">
        <div class="shop-head__text">
          <h1>{esc(shop["name"])}</h1>
          <p class="shop-head__addr">{esc(adr["strasse"])}, {esc(adr["plz"])} {esc(adr["ort"])} · Döner, Pizza, Lahmacun, Pide &amp; mehr</p>
          <ul class="shop-head__facts">
            <li class="open-state" data-open-state>Öffnungszeiten siehe unten</li>
            <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>Lieferung ca. {shop["lieferung"]["bereit_in_min"]} Min.</li>
            <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>Abholung ca. {shop["lieferung"]["abholung_bereit_in_min"]} Min.</li>
            <li><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/></svg>Mindestbestellwert {euro(shop_daten["mindestbestellwert"])}</li>
            <li><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>Lieferung gratis in {", ".join(gratis)}</li>
          </ul>
        </div>
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

    <div class="container shop-layout">
      <div class="menu">
        <p class="search-empty" hidden>Nichts gefunden. Versuch es mit einem anderen Wort, z. B. „Käse“ oder „Hähnchen“.</p>
        <p class="search-count" aria-live="polite"></p>
        {"".join(section_html(c) for c in cats)}
        {legend_html()}
        <p class="menu__note">Abbildungen sind Beispielfotos und können vom Gericht abweichen. Preise in Euro inkl. MwSt.</p>
      </div>
      <aside class="basket" id="warenkorb" aria-label="Warenkorb">
        <div class="basket__inner" data-warenkorb></div>
      </aside>
    </div>

    <button class="basket-bar" type="button" aria-controls="warenkorb" aria-expanded="false" hidden>
      <span class="basket-bar__count" data-anzahl>0</span>
      <span>Warenkorb ansehen</span>
      <strong data-summe>0,00 €</strong>
    </button>

    <dialog class="item-dialog" aria-labelledby="item-dialog-title"></dialog>
    <div class="toast" role="status" aria-live="polite" hidden></div>

    <script type="application/json" id="menu-daten">{json.dumps(menu_daten, ensure_ascii=False).replace("</", "<\\/")}</script>""",
    SHOP_SCRIPTS + '  <script src="assets/js/main.js" defer></script>\n  <script src="assets/js/menu.js" defer></script>\n',
    "page-menu page-shop",
)

# ---------- Kasse ----------
page(
    "kasse.html",
    "Kasse – Neusser Döner & Pizza",
    "Bestellung bei Neusser Döner & Pizza abschließen: Lieferung oder Abholung, Bezahlung bar oder mit Karte.",
    f"""    <section class="shop-head shop-head--slim">
      <div class="container">
        <a class="back" href="speisekarte.html">← Zurück zur Speisekarte</a>
        <h1>Bestellung abschließen</h1>
      </div>
    </section>

    <div class="container checkout" data-kasse>
      <form class="checkout__form" novalidate>
        <section class="co-card">
          <h2><span>1</span> Lieferart</h2>
          <div class="mode mode--big" role="radiogroup" aria-label="Lieferart">
            <label><input type="radio" name="art" value="lieferung"> <span>Lieferung</span></label>
            <label><input type="radio" name="art" value="abholung"> <span>Abholung</span></label>
          </div>
          <p class="co-hint" data-art-hinweis></p>
        </section>

        <section class="co-card">
          <h2><span>2</span> Deine Daten</h2>
          <div class="fields">
            <label class="field field--wide"><span>Vor- und Nachname *</span><input name="name" autocomplete="name" required maxlength="80"></label>
            <label class="field"><span>Telefon *</span><input name="telefon" type="tel" autocomplete="tel" required maxlength="25" placeholder="für Rückfragen"></label>
            <label class="field"><span>E-Mail (optional)</span><input name="email" type="email" autocomplete="email" maxlength="120"></label>
            <div class="fields fields--sub field--wide" data-nur="lieferung">
              <label class="field field--wide"><span>Firma (optional)</span><input name="firma" autocomplete="organization" maxlength="80"></label>
              <label class="field field--grow"><span>Straße *</span><input name="strasse" autocomplete="address-line1" maxlength="80"></label>
              <label class="field field--small"><span>Hausnr. *</span><input name="hausnr" maxlength="10"></label>
              <label class="field field--grow"><span>PLZ *</span><select name="plz" autocomplete="postal-code"></select></label>
              <label class="field"><span>Ort</span><input name="ort" readonly tabindex="-1"></label>
              <label class="field"><span>Etage</span><select name="etage"><option value="">Keine Angabe</option><option>Erdgeschoss</option><option>1. Etage</option><option>2. Etage</option><option>3. Etage</option><option>4. Etage</option><option>5. Etage</option><option>6. Etage</option><option>7. Etage</option><option>8. Etage</option><option>9. Etage</option><option>10. Etage</option></select></label>
            </div>
          </div>
        </section>

        <section class="co-card">
          <h2><span>3</span> Zeit &amp; Bezahlung</h2>
          <div class="fields">
            <label class="field"><span data-zeit-label>Liefertermin *</span><select name="zeit" required></select></label>
            <fieldset class="field pay">
              <legend>Bezahlung *</legend>
              <label class="pay__opt"><input type="radio" name="zahlung" value="bar" checked> <span>Bar</span></label>
              <label class="pay__opt"><input type="radio" name="zahlung" value="karte"> <span>EC- oder Kreditkarte</span></label>
            </fieldset>
            <label class="field field--wide"><span>Bemerkung (optional)</span><textarea name="bemerkung" rows="3" maxlength="500" placeholder="z. B. Klingel defekt, bitte anrufen"></textarea></label>
          </div>
          <p class="co-closed" data-geschlossen hidden></p>
        </section>

        <label class="consent"><input type="checkbox" name="datenschutz" required> <span>Ich habe die <a href="datenschutz.html" target="_blank">Datenschutzerklärung</a> gelesen und bin einverstanden, dass meine Angaben zur Bearbeitung der Bestellung verwendet werden. *</span></label>
        <label class="consent"><input type="checkbox" name="merken"> <span>Meine Daten auf diesem Gerät für die nächste Bestellung merken</span></label>
        <p class="co-error" role="alert" hidden></p>
        <button class="btn btn--primary btn--big checkout__submit" type="submit">Kostenpflichtig bestellen</button>
        <p class="co-hint co-hint--center">Lieber online mit PayPal bezahlen? <a href="bestellen.html">Über unseren Partner-Shop bestellen</a></p>
        <p class="co-hint co-hint--center" data-wa-hinweis hidden>Die Bestellung wird als fertige WhatsApp-Nachricht an uns geöffnet – bitte dort noch auf Senden tippen.</p>
      </form>

      <aside class="checkout__sum">
        <div class="basket__inner" data-warenkorb></div>
        <a class="checkout__edit" href="speisekarte.html">Warenkorb bearbeiten</a>
      </aside>
    </div>

    <section class="container done" data-fertig hidden>
      <div class="done__card">
        <div class="done__icon" aria-hidden="true">✓</div>
        <h2 data-fertig-titel>Danke für deine Bestellung!</h2>
        <p data-fertig-text></p>
        <a class="btn btn--primary" href="index.html">Zur Startseite</a>
      </div>
    </section>""",
    SHOP_SCRIPTS + '  <script src="assets/js/kasse.js" defer></script>\n',
    "page-checkout",
)

# ---------- Bestell-Monitor fürs Geschäft (nicht verlinkt, nicht in Suchmaschinen) ----------
mon_head = re.sub(r"<title>.*?</title>", "<title>Bestellungen – Neusser Döner &amp; Pizza</title>", HEAD, flags=re.S)
mon_head = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="robots" content="noindex, nofollow">', mon_head)
(ROOT / "bestellungen.html").write_text(f"""{mon_head}<body class="page-monitor">
  <main class="monitor" data-monitor>
    <header class="monitor__bar">
      <img src="assets/img/logo.webp" alt="Neusser Döner &amp; Pizza" width="560" height="375">
      <h1>Bestellungen</h1>
    </header>

    <p class="monitor__hint" data-hinweis hidden>Die Datenbank ist noch nicht eingerichtet. Solange kommen Online-Bestellungen per WhatsApp
      (siehe <code>assets/js/bestell-config.js</code>).</p>

    <form class="monitor__login" data-login hidden>
      <h2>Anmelden</h2>
      <label class="field"><span>E-Mail</span><input name="email" type="email" autocomplete="username" required></label>
      <label class="field"><span>Passwort</span><input name="passwort" type="password" autocomplete="current-password" required></label>
      <button class="btn btn--primary" type="submit">Anmelden</button>
      <p class="co-error" data-fehler aria-live="polite"></p>
    </form>

    <section data-board hidden>
      <div class="monitor__tools">
        <button class="m-btn m-btn--ton" type="button" data-ton aria-pressed="false">🔕 Ton aus – hier tippen</button>
        <label>Anzeigen <select data-filter><option value="offen">Offen</option><option value="alle">Alle (24 Std.)</option>
          <option value="fertig">Fertig</option><option value="storniert">Storniert</option></select></label>
        <label><input type="checkbox" data-autodruck> Beim Annehmen Bon drucken</label>
        <button class="m-btn" type="button" data-abmelden>Abmelden</button>
      </div>
      <div class="monitor__list" data-liste></div>
    </section>
  </main>
  <div class="bon" data-bon></div>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js" defer></script>
  <script src="assets/js/bestell-config.js" defer></script>
  <script src="assets/js/monitor.js" defer></script>
</body>
</html>
""", encoding="utf-8")
print("geschrieben: bestellungen.html")

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
      <h2>Online-Bestellung über diese Website</h2>
      <p>Wenn du über die Speisekarte und die Kasse dieser Website bestellst, verarbeiten wir die Angaben aus dem Bestellformular (Name, Telefonnummer, bei Lieferung die Adresse, freiwillig E-Mail, Firma, Etage und Bemerkung) sowie die bestellten Gerichte, um deine Bestellung zuzubereiten, zu liefern und bei Rückfragen anzurufen (Art. 6 Abs. 1 lit. b DSGVO).</p>
      <p>Der Warenkorb wird nur in deinem Browser gespeichert (localStorage). Wenn du „Meine Daten merken“ ankreuzt, werden auch deine Kontaktdaten nur in deinem Browser gespeichert, bis du das Häkchen wieder entfernst oder die Website-Daten löschst.</p>
      <p>Je nach Einstellung wird die Bestellung entweder in unserer Bestell-Datenbank bei Supabase (Supabase Inc., Server in Frankfurt am Main, EU) gespeichert, solange es für die Abwicklung, Rückfragen und gesetzliche Aufbewahrungspflichten nötig ist, oder als WhatsApp-Nachricht geöffnet, die du selbst an uns sendest. Für WhatsApp gelten zusätzlich die Datenschutzhinweise von WhatsApp Ireland Ltd.</p>
      <p>Die folgenden Abschnitte stammen aus der Datenschutzerklärung unseres Bestellshops (Speisebaron) und gelten für Bestellungen über die Seite „Online bestellen“.</p>
      {datenschutz_html()}
    </div>""",
    body_class="page-legal",
)
