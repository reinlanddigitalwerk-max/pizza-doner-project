# Neusser Döner & Pizza – Website

Neue Website für Neusser Döner & Pizza (Further Str. 46, 41462 Neuss) mit dem neuen Logo.

- Farbpalette: „Mediterran frisch“ (Gelb `#F9C015`, Olivgrün `#4F7A2C`, Paprikarot `#B8321F`, Dunkelbraun `#3A1C05`, Creme `#FAF3E8`)
- Startseite: Logo-Leiste → Angebote-Insel (öffnet sich wie die iPhone-Dynamic-Island) → Header mit 4 Hauptgerichten im Kreis → Angebotskarten → Kontakt/Öffnungszeiten/Impressum

## Seiten

- `index.html` – Startseite mit Angebote-Insel, Karussell und Angebotskarten
- `speisekarte.html` – komplette Speisekarte als Karten: Foto, Zutaten, Preise, Größen, Extras/Wünsche mit Aufpreisen, Allergene
- `bestellen.html` – der Bestellshop (Speisebaron, neusser-doener-pizza.de/bestellen) eingebettet; Bestellungen gehen weiter an Drucker/PayPal des Shops
- `ueber-uns.html` – Über uns, Kontakt, Öffnungs- und Lieferzeiten, Liefergebiete
- `impressum.html`, `datenschutz.html`

Alle Unterseiten werden gebaut mit `python3 tools/build_pages.py` (Logo-Leiste und Footer kommen aus `index.html`, der aktive Menüpunkt wird je Seite markiert). Das Skript füllt auch die Kategorie-Kacheln auf der Startseite zwischen `KATEGORIEN:START` und `KATEGORIEN:END`. Das Klappmenü für Handy/Tablet steckt in `assets/js/nav.js`.

## Daten aktualisieren

1. Aktuelle Shop-Daten speichern als `data/quellen/speisebaron-restaurant.json` (so, wie die Seite neusser-doener-pizza.de/bestellen sie lädt)
2. `python3 tools/import_speisebaron.py` → schreibt `data/menu.json` und `data/shop.json`
3. `python3 tools/build_pages.py` → baut die Unterseiten neu

Allergene/Zusatzstoffe stehen im Shop nicht je Gericht; sie kommen aus der alten Pizza-Taxi-Seite (`data/quellen/pizza-taxi-menu.json`), Zuordnung `ALT_NR` im Import-Skript.

## Lokal ansehen

`index.html` im Browser öffnen – kein Build nötig.

## Angebote pflegen

Alle Angebote und Öffnungszeiten stehen in `assets/js/offers-data.js`. Typen: `rabatt`, `menue`, `lieferung`, `stempelkarte`.
Jedes Angebot kann Tage, Uhrzeit, Enddatum und Mindestbestellwert haben; die Seite zeigt automatisch, ob es gerade gilt
(Zeit in Neuss). Die Insel zeigt nur Angebote, die gerade gelten.

Rabatte müssen zusätzlich im Bestellsystem (neusser-doener-pizza.de/bestellen) eingerichtet werden – die Website zeigt sie nur an.

## Daten

- `data/menu.json` – Speisekarte aus dem aktuellen Bestellshop (15 Kategorien, 101 Artikel, davon 95 aktiv)
- `data/shop.json` – Adresse, Telefon, Öffnungs-/Lieferzeiten, Liefergebiete, Zahlarten, Impressum-Angaben
- `data/quellen/` – Rohdaten beider alten Seiten (Speisebaron-Shop, Pizza-Taxi-Speisekarte, Datenschutztext)

## Bilder

Herkunft und Lizenzen: `assets/img/CREDITS.md`. Pizza und Lahmacun sind echte Fotos (CC0 / Public Domain),
Döner und Döner-Teller sind noch KI-Bilder aus Canva, bis eigene Fotos aus dem Laden da sind.
Freistellen: `tools/isnet_cut.py`.

## Noch offen

- Bedingungen für den 12-%-Rabatt (Mindestbestellwert, Tage, Zeitraum)
- Regeln für eine Stempelkarte, falls gewünscht
- Eigene Fotos von Döner und Döner-Teller
- Preis prüfen: „Döner-Sandwich mit extra Fleisch“ steht auf der alten Seite mit 8,00 € (gleich wie ohne)
- Datenschutzerklärung für die neue Seite

## Online bestellen (eigener Warenkorb wie auf der alten Seite)

- `speisekarte.html`: Gerichte antippen → Größe, Extras, Wunsch, Menge → Warenkorb rechts (Handy: Leiste unten).
  Lieferung/Abholung, Liefergebiet nach PLZ, Mindestbestellwert, aktive Rabatte aus `assets/js/offers-data.js`.
- `kasse.html`: Formular wie auf der alten Bestellseite (Name, Telefon, Adresse, Etage, Liefertermin, Bar/Karte, Bemerkung).
- Liefergebiete: `data/liefergebiete.json` (PLZ, Gebühr, Mindestbestellwert) – **vom Inhaber prüfen lassen**.
- Bezahlen: **online** mit Stripe (`api/checkout.php`, `api/webhook.php`) oder **bar / Karte bei Übergabe** (`api/bestellen.php`).
  Der Server rechnet Preise, Zeiten und Liefergebiet selbst nach (`api/lib.php`).
- Alle Bestellungen landen in `api/bestellungen/` (nicht im Web abrufbar) und per E-Mail an `SHOP_EMAIL`.
- Ist das Tablet im Laden aus (seit 90 Sekunden keine Abfrage), öffnet die Kasse für Bar/Karte wieder WhatsApp.

### Rheinland Bestellsystem (Tablet im Laden)

`/bestellsystem/` – App von Rheinland Digitalwerk fürs Tablet: Bestellungen mit Klingeln, Status
(Annehmen → Fertig → Unterwegs/Abgeholt) und automatischem Bon auf dem Epson TM-m30II (ePOS-Print, Bon als Bild).

1. GitHub-Secret `MONITOR_PASSWORT` anlegen und einmal hochladen lassen.
2. Drucker per LAN-Kabel an den Router, Tablet im selben WLAN. IP steht auf dem Status-Bon (Knopf hinten am Drucker).
3. Auf dem Tablet in Chrome `https://neusser-doner-pizza.de/bestellsystem/` öffnen, anmelden, ⚙ → IP prüfen →
   „Drucker freischalten“ (Zertifikat einmal erlauben) → „Testdruck“. Über das Chrome-Menü „Zum Startbildschirm hinzufügen“.
4. Jeden Tag: App öffnen, „Start“ tippen, Tablet am Strom lassen.

## App installieren

`manifest.webmanifest` + `sw.js` (wird von `tools/build_pages.py` erzeugt): Die Seite lässt sich als App auf den
Startbildschirm legen und öffnet Speisekarte, Startseite und Infos auch ohne Netz. Der Knopf „App installieren“
erscheint im Handy-Menü und im Footer, sobald der Browser es anbietet (iPhone: kurze Anleitung).

## Druckvorlagen mit QR-Code (Ordner `druck/`)

- `flyer-a5.pdf` (Vorder- und Rückseite), `tischkarte-a6.pdf`, `aufkleber-7cm.pdf`, `qr-speisekarte.svg`
- Der QR-Code führt zur Speisekarte. Neu erzeugen (z. B. bei eigener Domain oder neuen Preisen):
  `python3 tools/druck.py && node tools/druck-pdf.js` – die Adresse steht oben in `tools/druck.py`.
- Die PDFs haben keinen Beschnitt. Wenn die Druckerei 3 mm Beschnitt verlangt, kurz Bescheid geben.
