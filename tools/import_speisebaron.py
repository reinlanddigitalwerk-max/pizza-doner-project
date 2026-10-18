"""Baut data/menu.json und data/shop.json aus den Daten des aktuellen Bestellshops (Speisebaron).

Quelle: data/quellen/speisebaron-restaurant.json (so, wie die Shop-Seite sie lädt).
Allergene und Zusatzstoffe gibt es dort nicht je Gericht, sie kommen aus der alten
Pizza-Taxi-Speisekarte (data/quellen/pizza-taxi-menu.json) über den Namensabgleich ALT_NR.

Aufruf (im Projektordner): python3 tools/import_speisebaron.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SB = json.loads((ROOT / "data/quellen/speisebaron-restaurant.json").read_text(encoding="utf-8"))["restaurant"]
ALT = json.loads((ROOT / "data/quellen/pizza-taxi-menu.json").read_text(encoding="utf-8"))

# Schreibfehler im Shop korrigieren (nur Anzeige, Bedeutung bleibt)
FIX = {
    "Ornage": "Orange", "Gemichter": "Gemischter", "Warp": "Wrap", "Bologense": "Bolognese",
    "Quttro": "Quattro", "hausgenacht": "hausgemacht", "Susuc": "Sucuk", "Rigantoni": "Rigatoni",
    "Zusatzsaucce": "Zusatzsauce", "SIngle": "Single", "Tzaziki": "Tzatziki",
}

# Kategorienamen etwas aufräumen
KAT_NAME = {
    "Döner- Drehspießspezialitäten": "Döner & Drehspieß",
    "Schnitzel- Pommes & Co.": "Schnitzel",
    "NEU Burger (auch als Menü)": "Burger",
    "Imbiss-Gerichte": "Imbiss & Saucen",
    "Kinder Menü": "Für Kids",
    "Spar Menüs": "Spar-Menüs",
}

# Neue Gerichte → Nummer auf der alten Seite (für Allergene und Fotos)
ALT_NR = {
    "Pizzabrötchen|6 Stück": "33", "Pizzabrötchen|6 Stück mit Weißkäse": "34",
    "Pizzabrötchen|6 Stück mit Thunfisch und Zwiebeln": "35", "Pizzabrötchen|6 Stück mit Spinat und Käse": "36",
    "Pizzabrötchen|6 Stück mit Drehspießfleisch": "37",
    "Pizza Margherita": "38", "Pizza Salami": "39", "Pizza Prosciutto": "40", "Pizza Funghi": "41",
    "Pizza Tonno": "42", "Pizza Hawaii": "43", "Pizza Diavolo": "44", "Pizza Sucuk": "45", "Pizza Mista": "46",
    "Pizza Paprika": "47", "Pizza Spinat": "48", "Pizza Vegetaria": "49", "Pizza Nepal": "50", "Pizza Döner": "51",
    "Pizza Quattro Stagioni": "52", "Pizza Deluxe": "53", "Pizza California": "54", "Neusser Pizza": "55",
    "Pizza Quattro Formaggi": "56", "Pizza Calzone": "57",
    "Döner- Sandwich": "1", "Döner Wrap (hausgemacht)": "3", "Portion Drehspießfleisch": "4", "Döner Teller": "5",
    "Pomm- Döner|Drehspießfleisch in der Box, mit Salat und Sauce": "6",
    "Pomm- Döner|Drehspießfleisch in der Box, mit Pommes frites, Salat und Sauce": "7",
    "Pomm- Döner|Drehspießfleisch in der Box, mit Reis, Salat und Sauce": "8",
    "Döner überbacken": "9",
    "Lahmacun": "11", "Lahmacun Salat": "12", "Lahmacun Fleisch": "13",
    "Falafel Sandwich": "14", "Falafel Wrap (hausgemacht)": "15", "Falafel Teller": "16",
    "Salat Tasche": "17", "Salat Wrap": "18",
    "Gemichter Salat": "19", "Döner Salat": "20", "Thunfisch Salat": "21", "Bauernsalat": "22",
    "Pide Käse": "23", "Pide Hackfleisch": "24", "Pide Spinat": "25", "Pide Döner": "26", "Pide Sucuk": "27",
    "Schnitzel Wiener Art": "58", "Jägerschnitzel": "59", "Paprikaschnitzel": "60",
    "Hamburger": "28", "Cheeseburger": "29", "Chili- Cheeseburger": "30", "Crispy Chickenburger": "31",
    "Crispy Chicken- Cheeseburger": "32",
    "Pommes frites": "61", "Reis": "62", "Chicken Nuggets": "63", "Currywurst": "64",
    "Currywurst mit Pommes frites": "65", "Doppelte Currywurst mit Pommes": "66",
    "Ketchup": "S1", "Mayonnaise": "S2", "Tzatziki": "S3", "Cocktailsauce": "S4", "Currysauce": "S5",
    "Jägersauce": "S6", "Paprikasauce": "S7", "scharfe Sauce": "S8", "Aioli": "S9", "Kräuterbutter": "S10",
    "Peperoni": "62a", "Oliven": "62b",
    "Kindermenü": "K1", "Döner Menü": "M1", "Wrap Menü": "M2", "Lahmacun Menü": "M3", "Falafel Menü": "M4",
    "Coca Cola 0,33 L": "68a", "Fanta Ornage 0,33 L": "68b", "Sprite 0,33 L": "68d", "Mezzo Mix 0,33 L": "68e",
    "Wasser 0,5 L": "70", "Ayran 0,2 L": "71", "Durstlöscher 0,5 L": "72",
}


def clean(s):
    s = (s or "").strip()
    s = re.sub(r"^\d{3}\s+", "", s)          # "001   normal" → "normal"
    for a, b in FIX.items():
        s = s.replace(a, b)
    s = re.sub(r"\s*-\s+", "-", s) if re.search(r"\w- \w", s) else s   # "Döner- Sandwich" → "Döner-Sandwich"
    s = re.sub(r"\s{2,}", " ", s)
    return s


def euro(c):
    return round(c / 100, 2)


def optionen(opts):
    out = []
    for o in opts:
        ch = [{"name": clean(c["name"]), "aufpreis": euro(c.get("price", 0))} for c in o.get("choices", []) if c.get("active", True)]
        if not ch:
            continue
        out.append({"titel": clean(o.get("name")).rstrip("?") + ("?" if (o.get("name") or "").strip().endswith("?") else ""),
                    "mehrfach": bool(o.get("multiple")), "auswahl": ch})
    return out


alt_by_nr = {a["nr"]: a for k in ALT["kategorien"] for a in k["artikel"]}

kategorien = []
pizza = None
for c in SB["shopMenu"]:
    name = c["name"]
    beschreibung = clean(c.get("description", ""))
    artikel = []
    for d in c["dishs"]:
        if not d.get("name") or "price" not in d:   # unvollständige Einträge im Shop überspringen
            continue
        key1 = f'{d.get("name","").strip()}|{d.get("description","").strip()}'
        key2 = d.get("name", "").strip()
        alt_nr = ALT_NR.get(key1) or ALT_NR.get(key2)
        alt = alt_by_nr.get(alt_nr, {})
        a = {
            "nr": (d.get("alias") or "").strip(),
            "name": clean(d.get("name", "")),
            "beschreibung": clean(d.get("description", "")),
            "preis": euro(d["price"]),
            "aktiv": bool(d.get("active", True)),
        }
        if alt.get("allergene"):
            a["allergene"] = alt["allergene"]
        if alt_nr:
            a["alt_nr"] = alt_nr
        if d.get("options"):
            a["optionen"] = optionen(d["options"])
        # gleiche Namen in einer Kategorie eindeutig machen
        if a["name"] == "Pizzabrötchen":
            rest = re.sub(r"^6 Stück\s*", "", a["beschreibung"])
            a["name"] = "6 Pizzabrötchen" + (f" {rest}" if rest else "")
        if a["name"] == "Pomm-Döner" and alt.get("name"):
            a["name"] = alt["name"]
        if not a["beschreibung"]:
            del a["beschreibung"]
        artikel.append(a)

    if name.startswith("Pizza "):          # 24 cm und 30 cm zu einer Kategorie mit zwei Größen
        groesse = "Ø" + name.split()[1] + "cm"
        if pizza is None:
            pizza = {"kategorie": "Pizza", "beschreibung": beschreibung, "groessen": ["Ø24cm", "Ø30cm"],
                     "basis": ["Tomatensauce", "Gouda", "Oregano"], "hinweis": beschreibung,
                     "bild_quelle": c.get("image"), "optionen": optionen(c.get("options", [])), "artikel": []}
            kategorien.append(pizza)
        for a in artikel:
            ex = next((x for x in pizza["artikel"] if x["nr"] == a["nr"]), None)
            if ex is None:
                ex = {k: v for k, v in a.items() if k != "preis"}
                ex["preise"] = {}
                pizza["artikel"].append(ex)
            ex["preise"][groesse] = a["preis"]
        continue

    kategorien.append({
        "kategorie": KAT_NAME.get(name, clean(name)),
        **({"beschreibung": beschreibung} if beschreibung else {}),
        "bild_quelle": c.get("image"),
        **({"optionen": optionen(c["options"])} if c.get("options") else {}),
        "artikel": artikel,
    })

def slug(s):
    s = s.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


# Kategoriefotos (von der Shop-Seite, gespeichert in assets/img/kategorien/<slug>.webp)
for k in kategorien:
    f = f"assets/img/kategorien/{slug(k['kategorie'])}.webp"
    if (ROOT / f).exists():
        k["bild"] = f

menu = {
    "quelle": "Bestellshop neusser-doener-pizza.de (Speisebaron), Stand der Daten: "
              + max(d["updatedAt"] for c in SB["shopMenu"] for d in c["dishs"])[:10],
    "kategorien": kategorien,
    "zusatzstoffe": ALT["zusatzstoffe"],
    "allergene": ALT["allergene"],
    "hinweise": ALT["hinweise"],
}
(ROOT / "data/menu.json").write_text(json.dumps(menu, ensure_ascii=False, indent=2), encoding="utf-8")

# ---------- Shop-Daten ----------
def hhmm(v):
    return f"{v // 100:02d}:{v % 100:02d}"

DOW = {1: "Montag", 2: "Dienstag", 3: "Mittwoch", 4: "Donnerstag", 5: "Freitag", 6: "Samstag", 0: "Sonntag"}

def zeiten(lst):
    by = {h["dow"]: [hhmm(h["from"]), hhmm(h["to"])] for h in lst}
    return {DOW[d]: by.get(d) for d in (1, 2, 3, 4, 5, 6, 0)}

shop = {
    "name": SB["name"],
    "inhaber": "Negrvan Mahmoud",
    "adresse": {"strasse": "Further Straße 46", "plz": SB["address"]["zip"], "ort": SB["address"]["city"]},
    "telefon": "02131 3166137",
    "telefon_link": "+4921313166137",
    "telefon_mobil": "0157 71066644",
    "ust_idnr": SB.get("salesTaxId"),
    "steuernummer": SB.get("taxId"),
    "aufsichtsbehoerde": "Stadt Neuss",
    "koordinaten": {"lat": SB["location"]["coordinates"][1], "lng": SB["location"]["coordinates"][0]},
    "bestellen_url": "https://neusser-doener-pizza.de/bestellen",
    "oeffnungszeiten": zeiten(SB["hours"]),
    "lieferzeiten": zeiten(SB["hoursDelivery"]),
    "geschlossen_an": [h["date"][:10] for h in SB.get("hoursSpecial", []) if not h.get("open")],
    "lieferung": {
        "zonen": [{"name": z["name"], "liefergebuehr": euro(z["shipping"]), "mindestbestellwert": euro(z["minValue"])}
                  for z in sorted(SB["zones"], key=lambda z: z["name"])],
        "bereit_in_min": SB["order"]["delivery"].get("readyIn"),
        "abholung_bereit_in_min": SB["order"]["takeOut"].get("readyIn"),
        "vorbestellung": SB["order"].get("allowPreorder", False),
    },
    "zahlung": ["Bar", "PayPal", "EC-Karte", "Kreditkarte"],
    # aus den Merkmalen des Shops (feat_*/spec_*); Gluten/Laktose weggelassen, da unklar ist, was genau gemeint ist
    "merkmale": ["Abholung", "Lieferung", "Sitzplätze im Laden", "Steinofen", "Halal", "Vegetarische Gerichte"],
    "ueber_uns": SB.get("about", ""),
}
(ROOT / "data/shop.json").write_text(json.dumps(shop, ensure_ascii=False, indent=2), encoding="utf-8")

n = sum(len(k["artikel"]) for k in kategorien)
aktiv = sum(1 for k in kategorien for a in k["artikel"] if a.get("aktiv", True))
ohne = [a["name"] for k in kategorien for a in k["artikel"] if "alt_nr" not in a]
print(f"{len(kategorien)} Kategorien, {n} Artikel ({aktiv} aktiv). Ohne Gegenstück auf der alten Seite: {ohne}")
