// Wohin gehen die Bestellungen aus der Kasse?
//
// Mit Datenbank (Supabase): URL und Publishable Key des Projekts eintragen. Dann landen die
// Bestellungen in der Datenbank und erscheinen sofort auf bestellungen.html im Laden.
// Ohne Datenbank (beide Felder leer): die Kasse öffnet WhatsApp mit der fertigen Bestellung
// an die Nummer aus data/shop.json (telefon_mobil).
window.BESTELL_CONFIG = {
  supabaseUrl: '',
  supabaseKey: ''
};
