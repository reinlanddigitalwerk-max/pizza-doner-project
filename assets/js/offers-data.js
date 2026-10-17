// Angebote und Öffnungszeiten – hier pflegen, die Seite baut Insel und Angebotskarten daraus.
//
// Angebots-Typen (wie bei Lieferando, nur auf unsere Art):
//   "rabatt"       – Prozent-Rabatt, optional mit Mindestbestellwert, Tagen und Uhrzeit
//   "menue"        – Menü zum Festpreis
//   "lieferung"    – kostenlose Lieferung ab Bestellwert
//   "stempelkarte" – z. B. nach 5 Bestellungen ein Gutschein (erst aktivieren, wenn die Regeln feststehen)
//
// Felder:
//   aktiv:        false blendet das Angebot aus
//   tage:         Wochentage, an denen es gilt (1 = Montag … 7 = Sonntag). Leer = jeden Öffnungstag
//   von / bis:    Uhrzeit "HH:MM" (optional)
//   gueltigBis:   letztes Datum "JJJJ-MM-TT" (optional)
//   mindestwert:  Mindestbestellwert in Euro (optional)
//   bild / icon:  Bild für Insel und Karte
//
// Die Rabatte müssen auch im Bestellsystem (neusser-doener-pizza.de/bestellen) eingerichtet sein –
// diese Seite zeigt sie nur an.
window.NEUSSER = {
  oeffnungszeiten: {
    // 1 = Montag … 7 = Sonntag; null = Ruhetag
    1: null,
    2: ['12:00', '21:30'],
    3: ['12:00', '21:30'],
    4: ['12:00', '21:30'],
    5: ['12:00', '23:00'],
    6: ['12:00', '23:00'],
    7: ['12:00', '21:30']
  },

  angebote: [
    {
      id: 'rabatt-12',
      typ: 'rabatt',
      aktiv: true,
      prozent: 12,
      titel: 'Rabatt',
      text: 'Jetzt online bestellen und sparen.',
      bild: 'assets/img/icons/rabatt-12.webp'
      // TODO: Bedingungen vom Inhaber ergänzen, z. B. mindestwert: 20, tage: [2, 3, 4]
    },
    {
      id: 'doener-menue',
      typ: 'menue',
      aktiv: true,
      titel: 'Döner-Menü',
      preis: 12.00,
      text: 'Döner-Sandwich mit Pommes frites und ein Softdrink (0,33 l) nach Wahl.',
      bild: 'assets/img/dishes/doener.webp'
    },
    {
      id: 'lahmacun-menue',
      typ: 'menue',
      aktiv: true,
      titel: 'Lahmacun-Menü',
      preis: 13.00,
      text: 'Lahmacun mit Drehspießfleisch, Pommes frites und ein Softdrink (0,33 l) nach Wahl.',
      bild: 'assets/img/dishes/lahmacun.webp'
    },
    {
      id: 'frei-haus',
      typ: 'lieferung',
      aktiv: true,
      titel: 'Frei Haus',
      mindestwert: 50,
      text: 'Ab 50 € Bestellwert liefern wir ohne Liefergebühr.',
      bild: 'assets/img/icons/pizza.webp'
    },
    {
      id: 'stempelkarte',
      typ: 'stempelkarte',
      aktiv: false,
      titel: 'Stempelkarte',
      text: 'Regeln noch offen.',
      bild: 'assets/img/icons/flamme.webp'
    }
  ]
};
