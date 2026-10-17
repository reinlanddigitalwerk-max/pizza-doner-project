# Neusser Döner & Pizza – Website

Neue Website für Neusser Döner & Pizza (Further Str. 46, 41462 Neuss) mit dem neuen Logo.

- Farbpalette: „Mediterran frisch“ (Gelb `#F9C015`, Olivgrün `#4F7A2C`, Paprikarot `#B8321F`, Dunkelbraun `#3A1C05`, Creme `#FAF3E8`)
- Startseite: Logo-Leiste → Angebote-Insel (öffnet sich wie die iPhone-Dynamic-Island) → Header mit 4 Hauptgerichten im Kreis → Angebotskarten → Kontakt/Öffnungszeiten/Impressum

## Seiten

- `index.html` – Startseite
- `speisekarte.html` – komplette Speisekarte als Karten: Foto, Zutaten, Preise, Größen, Allergene und Zusatzstoffe.
  Bild je Artikel: Zuordnung `BILD` in `tools/build_menu.py`, Dateien in `assets/img/menu/`.
  Wird aus `data/menu.json` gebaut: `python3 tools/build_menu.py` (nach jeder Änderung an der Speisekarte ausführen)

## Lokal ansehen

`index.html` im Browser öffnen – kein Build nötig.

## Angebote pflegen

Alle Angebote und Öffnungszeiten stehen in `assets/js/offers-data.js`. Typen: `rabatt`, `menue`, `lieferung`, `stempelkarte`.
Jedes Angebot kann Tage, Uhrzeit, Enddatum und Mindestbestellwert haben; die Seite zeigt automatisch, ob es gerade gilt
(Zeit in Neuss). Die Insel zeigt nur Angebote, die gerade gelten.

Rabatte müssen zusätzlich im Bestellsystem (neusser-doener-pizza.de/bestellen) eingerichtet werden – die Website zeigt sie nur an.

## Daten

- `data/menu.json` – komplette Speisekarte (13 Kategorien, 92 Artikel) von neusser-doener-und-pizza.de
- `data/shop.json` – Adresse, Telefon, Öffnungszeiten, Liefergebiete, Impressum-Angaben

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
