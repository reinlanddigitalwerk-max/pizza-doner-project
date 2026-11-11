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
    // 1 = Montag … 7 = Sonntag; null = Ruhetag (Stand: Speisekarte November 2026; Feiertage wie Samstag/Sonntag)
    1: null,
    2: ['11:30', '21:30'],
    3: ['11:30', '21:30'],
    4: ['11:30', '21:30'],
    5: ['11:30', '21:30'],
    6: ['12:00', '21:30'],
    7: ['12:00', '21:30']
  },

  // Lieferung: laut neuer Karte zu den Öffnungszeiten (Abholung – Lieferung – vor Ort)
  lieferzeiten: {
    1: null,
    2: ['11:30', '21:30'],
    3: ['11:30', '21:30'],
    4: ['11:30', '21:30'],
    5: ['11:30', '21:30'],
    6: ['12:00', '21:30'],
    7: ['12:00', '21:30']
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
      id: 'mittags-paket',
      typ: 'menue',
      aktiv: true,
      titel: 'Mittags-Paket',
      preis: 18.00,
      tage: [2, 3, 4, 5, 6, 7],
      von: '11:30',
      bis: '14:30',
      text: '1 Pizza mit 2 Zutaten nach Wahl, 1 Döner-Sandwich, 1 Pommes und ein Softdrink (0,33 l) – nur über unsere Website.',
      bild: 'assets/img/menu/mittags-paket-l.webp'
    },
    {
      id: 'team-paket',
      typ: 'menue',
      aktiv: true,
      titel: 'Team-Paket',
      preis: 32.00,
      text: '2 Pizzen mit je 2 Zutaten, 2 Döner-Sandwiches und 1 gemischter Salat – für Büro, Familie und Freunde. Nur über unsere Website.',
      bild: 'assets/img/menu/team-paket-l.webp'
    },
    {
      id: 'mittwoch',
      typ: 'menue',
      aktiv: true,
      titel: 'Mittwochsangebot',
      preis: 7.00,
      tage: [3],
      text: 'Jede Pizza (30 cm) nur 7,00 € – Margherita nur 6,00 €.',
      bild: 'assets/img/menu/pizza-neu-l.webp'
    },
    {
      id: 'steak-lamm',
      typ: 'menue',
      aktiv: true,
      titel: 'Döner Steak Lamm',
      preis: 9.00,
      tage: [4, 7],
      text: 'Unser Lamm-Steak-Döner im Fladenbrot mit Salat und Sauce – nur sonntags und donnerstags.',
      bild: 'assets/img/menu/doener-sandwich-l.webp'
    },
    {
      id: 'doener-menue',
      typ: 'menue',
      aktiv: true,
      titel: 'Döner-Menü',
      preis: 11.50,
      text: 'Döner-Sandwich mit Pommes und ein Softdrink (0,33 l) nach Wahl.',
      bild: 'assets/img/dishes/doener.webp'
    },
    {
      id: 'burger-menue',
      typ: 'menue',
      aktiv: true,
      titel: 'Burger als Menü',
      preisAb: 3.50,
      text: 'Jeden Burger mit Pommes und Softdrink (0,33 l) – für 3,50 € Aufpreis.',
      bild: 'assets/img/menu/neusser-burger-l.webp'
    },
    {
      id: 'gratis-lieferung',
      typ: 'lieferung',
      aktiv: true,
      titel: 'Gratis Lieferung',
      text: 'Ab 15 € (Neuss-Mitte und Furth), 20 € (Grimlinghausen, Norf, Holzheim) oder 25 € (Kaarst, Meerbusch, Heerdt) liefern wir kostenlos – sonst 1 €, 2 € bzw. 3 €.',
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
