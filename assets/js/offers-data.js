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
// Aktive Rabatte werden im Warenkorb der Website (Speisekarte und Kasse) automatisch abgezogen.
// Für Bestellungen über Speisebaron (bestellen.html) müssen sie dort extra als Gutschein angelegt werden.
window.NEUSSER = {
  oeffnungszeiten: {
    // 1 = Montag … 7 = Sonntag; null = Ruhetag (Stand: Bestellshop neusser-doener-pizza.de)
    1: null,
    2: ['11:00', '22:00'],
    3: ['11:00', '22:00'],
    4: ['11:00', '22:00'],
    5: ['11:00', '22:00'],
    6: ['11:00', '22:00'],
    7: ['12:00', '22:00']
  },

  // Lieferung nur in dieser Zeit
  lieferzeiten: {
    1: null,
    2: ['14:30', '21:30'],
    3: ['14:30', '21:30'],
    4: ['14:30', '21:30'],
    5: ['14:30', '21:30'],
    6: ['14:30', '21:30'],
    7: ['14:30', '21:30']
  },

  // Tage, an denen geschlossen ist (Format JJJJ-MM-TT)
  geschlossen: ['2025-12-24', '2025-12-25', '2025-12-26'],

  angebote: [
    {
      id: 'rabatt-12',
      typ: 'rabatt',
      // Test-Angebot: aus, weil Rabatte jetzt im Warenkorb der Website wirklich abgezogen werden.
      // Auf true setzen, sobald der Inhaber die 12 % geben möchte.
      aktiv: false,
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
      id: 'burger-menue',
      typ: 'menue',
      aktiv: true,
      titel: 'Burger als Menü',
      preisAb: 2.50,
      text: 'Jeden Burger mit Pommes frites und Coca-Cola, Coke Zero, Fanta Orange oder Fanta Exotik – ab 2,50 € Aufpreis.',
      bild: 'assets/img/kategorien/burger.webp'
    },
    {
      id: 'gratis-lieferung',
      typ: 'lieferung',
      aktiv: true,
      titel: 'Gratis Lieferung',
      mindestwert: 10,
      text: 'Im Umkreis von 2 km liefern wir ohne Liefergebühr. Bis 5 km kostet die Lieferung 2 €.',
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
