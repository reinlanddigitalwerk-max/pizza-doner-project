"""Druckvorlagen mit QR-Code zur Speisekarte:

  druck/qr-speisekarte.svg   – QR-Code allein (für eigene Vorlagen)
  druck/flyer-a5.html        – Flyer A5, Vorder- und Rückseite
  druck/tischkarte-a6.html   – Tischaufsteller A6
  druck/aufkleber-7cm.html   – Aufkleber 7 × 7 cm für Tüten und Kartons

PDFs danach mit:  node tools/druck-pdf.js
Ändert sich die Adresse der Website (eigene Domain), oben SEITE anpassen und beides neu ausführen.
Aufruf (im Projektordner): python3 tools/druck.py
"""
import datetime
import html
import json
from pathlib import Path

from reportlab.graphics.barcode import qrencoder

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "druck"
SEITE = "https://reinlanddigitalwerk-max.github.io/pizza-doner-project/"
ZIEL = SEITE + "speisekarte.html"

menu = json.loads((ROOT / "data/menu.json").read_text(encoding="utf-8"))
shop = json.loads((ROOT / "data/shop.json").read_text(encoding="utf-8"))


def euro(n):
    return f"{n:.2f}".replace(".", ",") + " €"


def preis(name):
    for c in menu["kategorien"]:
        for a in c["artikel"]:
            if a["name"] == name and a.get("aktiv", True):
                return ("ab " + euro(min(a["preise"].values()))) if "preise" in a else euro(a["preis"])
    raise KeyError(name)


def qr_svg(text, farbe="#3A1C05"):
    qr = qrencoder.QRCode(None, qrencoder.QRErrorCorrectLevel.M)
    qr.addData(text)
    qr.make()
    n = qr.getModuleCount()
    rand = 4
    pfad = "".join(f"M{c + rand} {r + rand}h1v1h-1z" for r in range(n) for c in range(n) if qr.isDark(r, c))
    g = n + 2 * rand
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {g} {g}" shape-rendering="crispEdges">'
            f'<rect width="{g}" height="{g}" fill="#fff"/><path fill="{farbe}" d="{pfad}"/></svg>')


QR = qr_svg(ZIEL)
MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"]
heute = datetime.date.today()
STAND = f"{MONATE[heute.month - 1]} {heute.year}"
KURZ = ZIEL.replace("https://", "")
TEL = shop["telefon"]
ADR = f'{shop["adresse"]["strasse"]} · {shop["adresse"]["plz"]} {shop["adresse"]["ort"]}'

KOPF = """<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>{titel}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@500;600;700;800&family=Lilita+One&display=swap">
<style>
  @page {{ size: {breite}mm {hoehe}mm; margin: 0; }}
  * {{ box-sizing: border-box; }}
  html, body {{ margin: 0; }}
  body {{ font-family: "Figtree", sans-serif; color: #3A1C05; -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
  .seite {{ position: relative; width: {breite}mm; height: {hoehe}mm; overflow: hidden; page-break-after: always; }}
  .seite:last-child {{ page-break-after: auto; }}
  .display {{ font-family: "Lilita One", sans-serif; font-weight: 400; }}
  .qr svg {{ display: block; width: 100%; height: auto; }}
  {css}
</style></head><body>
"""
FUSS = "</body></html>\n"


def schreiben(datei, titel, breite, hoehe, css, inhalt):
    (OUT / datei).write_text(KOPF.format(titel=titel, breite=breite, hoehe=hoehe, css=css) + inhalt + FUSS, encoding="utf-8")
    print("geschrieben:", "druck/" + datei)


OUT.mkdir(exist_ok=True)
(OUT / "qr-speisekarte.svg").write_text(QR, encoding="utf-8")
print("geschrieben: druck/qr-speisekarte.svg →", ZIEL)

IMG = "../assets/img"
z = shop["oeffnungszeiten"]
lz = shop["lieferzeiten"]

# ---------- Flyer A5 ----------
klassiker = [("Döner-Sandwich", "Döner-Sandwich"), ("Döner Teller", "Döner Teller"), ("Lahmacun", "Lahmacun"),
           ("Pizza Margherita", "Pizza Margherita"), ("Falafel Sandwich", "Falafel Sandwich"), ("Döner Menü", "Döner Menü")]
klassiker_html = "".join(f"<li><span>{html.escape(t)}</span><b>{preis(n)}</b></li>" for t, n in klassiker)
schreiben("flyer-a5.html", "Flyer A5 – Neusser Döner & Pizza", 148, 210, """
  .vorne { background: radial-gradient(circle at 30% 45%, rgba(249,192,21,.28), transparent 45%), #4F7A2C; color: #FAF3E8; padding: 10mm 10mm 0; }
  .vorne::before { content: ""; position: absolute; inset: 0; background: radial-gradient(rgba(255,255,255,.08) 1px, transparent 1.4px) 0 0 / 5mm 5mm; }
  .vorne > * { position: relative; }
  .logo { width: 46mm; margin: 0 auto; display: block; filter: drop-shadow(0 2mm 3mm rgba(0,0,0,.35)); }
  .titel { margin: 4mm 0 0; text-align: center; font-size: 30pt; line-height: .98; }
  .titel span { color: #F9C015; }
  .gerichte { position: relative; height: 84mm; margin-top: 3mm; }
  .gerichte img { position: absolute; filter: drop-shadow(0 3mm 3mm rgba(0,0,0,.4)); }
  .g1 { width: 92mm; left: 18mm; top: 12mm; z-index: 2; }
  .g2 { width: 52mm; left: -4mm; top: 2mm; transform: rotate(-8deg); }
  .g3 { width: 52mm; right: -4mm; top: 0; transform: rotate(8deg); }
  .karte { position: absolute; left: 8mm; right: 8mm; bottom: 8mm; display: flex; gap: 5mm; align-items: center; padding: 5mm; border-radius: 6mm; background: #FAF3E8; color: #3A1C05; box-shadow: 0 2mm 6mm rgba(0,0,0,.3); }
  .karte .qr { flex: none; width: 34mm; }
  .karte h2 { margin: 0; font-size: 19pt; line-height: 1.05; }
  .karte p { margin: 2mm 0 0; font-size: 10pt; font-weight: 600; }
  .karte .tel { display: block; margin-top: 2mm; font-size: 15pt; font-weight: 800; color: #3C5F20; }
  .hinten { background: #FAF3E8; padding: 8mm 10mm 7mm; display: flex; flex-direction: column; gap: 3.5mm; }
  .hinten h2 { margin: 0 0 1.5mm; font-size: 17pt; }
  .box { padding: 3.5mm 5mm; border-radius: 4mm; background: #fff; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
  td { padding: .6mm 0; } td:last-child { text-align: right; font-weight: 700; }
  .liste { margin: 0; padding: 0; list-style: none; font-size: 10.5pt; }
  .liste li { display: flex; justify-content: space-between; padding: 1mm 0; border-bottom: .3mm dashed #E3D4C2; }
  .liste b { color: #B8321F; }
  .tags { display: flex; flex-wrap: wrap; gap: 1.5mm; margin: 0; padding: 0; list-style: none; }
  .tags li { padding: .8mm 3mm; border-radius: 10mm; background: #E7F1DD; color: #2F5A14; font-weight: 700; font-size: 9pt; }
  .unten { margin-top: auto; display: flex; gap: 5mm; align-items: center; padding: 4mm 5mm; border-radius: 4mm; background: #3A1C05; color: #FAF3E8; }
  .unten .qr { flex: none; width: 24mm; padding: 1.2mm; background: #fff; border-radius: 2mm; }
  .unten b { color: #F9C015; font-size: 13pt; }
  .unten p { margin: 0; font-size: 10pt; }
  .klein { font-size: 7.5pt; color: #6F5946; margin: 0; }
""", f"""
<section class="seite vorne">
  <img class="logo" src="{IMG}/logo.webp" alt="">
  <h1 class="titel display">Frisch vom Spieß.<br><span>Heiß aus dem Ofen.</span></h1>
  <div class="gerichte">
    <img class="g2" src="{IMG}/dishes/pizza.webp" alt="">
    <img class="g3" src="{IMG}/dishes/lahmacun.webp" alt="">
    <img class="g1" src="{IMG}/dishes/doener.webp" alt="">
  </div>
  <div class="karte">
    <div class="qr">{QR}</div>
    <div>
      <h2 class="display">Scannen &amp; bestellen</h2>
      <p>Speisekarte mit Preisen und Online-Bestellung – Lieferung oder Abholung.</p>
      <span class="tel">☎ {TEL}</span>
    </div>
  </div>
</section>
<section class="seite hinten">
  <div class="box">
    <h2 class="display">Öffnungszeiten</h2>
    <table>
      <tr><td>Montag</td><td>Ruhetag</td></tr>
      <tr><td>Dienstag – Samstag</td><td>{z["Dienstag"][0]} – {z["Dienstag"][1]} Uhr</td></tr>
      <tr><td>Sonntag</td><td>{z["Sonntag"][0]} – {z["Sonntag"][1]} Uhr</td></tr>
      <tr><td>Lieferung Di – So</td><td>{lz["Dienstag"][0]} – {lz["Dienstag"][1]} Uhr</td></tr>
    </table>
  </div>
  <div class="box">
    <h2 class="display">Lieferung</h2>
    <table>
      <tr><td>bis 2 km</td><td>kostenlos</td></tr>
      <tr><td>2 – 5 km</td><td>2,00 €</td></tr>
      <tr><td>Mindestbestellwert</td><td>10,00 €</td></tr>
      <tr><td>Abholung</td><td>in ca. {shop["lieferung"]["abholung_bereit_in_min"]} Minuten fertig</td></tr>
    </table>
  </div>
  <div class="box">
    <h2 class="display">Unsere Klassiker</h2>
    <ul class="liste">{klassiker_html}</ul>
  </div>
  <ul class="tags"><li>Halal</li><li>Pizza aus dem Steinofen</li><li>Vegetarische Gerichte</li><li>Sitzplätze im Laden</li></ul>
  <div class="unten">
    <div class="qr">{QR}</div>
    <p><b>{html.escape(shop["name"])}</b><br>{html.escape(ADR)}<br>Tel. {TEL}<br>Bar, PayPal, EC- und Kreditkarte</p>
  </div>
  <p class="klein">Preise in Euro inkl. MwSt., Stand {STAND}. Abbildungen ähnlich. Alle Gerichte und Allergene: {KURZ}</p>
</section>
""")

# ---------- Tischkarte A6 ----------
schreiben("tischkarte-a6.html", "Tischkarte A6 – Neusser Döner & Pizza", 105, 148, """
  .seite { background: #FAF3E8; padding: 8mm; display: flex; flex-direction: column; align-items: center; text-align: center; }
  .seite::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 30mm; background: #4F7A2C; border-radius: 0 0 50% 50% / 0 0 8mm 8mm; }
  .logo { position: relative; width: 38mm; filter: drop-shadow(0 1.5mm 2mm rgba(0,0,0,.3)); }
  h1 { margin: 5mm 0 0; font-size: 22pt; line-height: 1; }
  h1 span { color: #4F7A2C; }
  .qr { width: 58mm; margin: 5mm 0 0; padding: 2.5mm; border-radius: 4mm; background: #fff; box-shadow: 0 0 0 1.2mm #F9C015; }
  p { margin: 4mm 0 0; font-size: 10.5pt; font-weight: 600; }
  .tel { margin-top: auto; font-size: 14pt; font-weight: 800; color: #3C5F20; }
""", f"""
<section class="seite">
  <img class="logo" src="{IMG}/logo.webp" alt="">
  <h1 class="display">Speisekarte<br><span>scannen &amp; bestellen</span></h1>
  <div class="qr">{QR}</div>
  <p>Handy-Kamera auf den Code halten – fertig.<br>Lieferung oder Abholung.</p>
  <span class="tel">☎ {TEL}</span>
</section>
""")

# ---------- Aufkleber 7 × 7 cm ----------
schreiben("aufkleber-7cm.html", "Aufkleber 7 cm – Neusser Döner & Pizza", 70, 70, """
  .seite { border-radius: 35mm; background: #4F7A2C; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #FAF3E8; text-align: center; }
  .qr { width: 30mm; padding: 1.5mm; border-radius: 2mm; background: #fff; }
  .t { margin: 0 0 2mm; font-size: 11pt; line-height: 1; color: #F9C015; }
  .tel { margin-top: 2mm; font-size: 8.5pt; font-weight: 800; }
""", f"""
<section class="seite">
  <p class="t display">Nochmal bestellen?</p>
  <div class="qr">{QR}</div>
  <span class="tel">☎ {TEL}</span>
</section>
""")
