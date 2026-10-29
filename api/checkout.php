<?php
// Startet die Online-Zahlung: prüft die Bestellung, rechnet selbst nach und öffnet eine Stripe-Checkout-Seite.
//   GET  → {"aktiv": true|false}   (zeigt die Kasse „Jetzt online bezahlen“ an?)
//   POST → {"url": "https://checkout.stripe.com/…"}  oder  {"fehler": "…"}
declare(strict_types=1);
require __DIR__ . '/lib.php';

$aktiv = (string) (geheim()['stripe_secret'] ?? '') !== '';
$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($methode === 'GET') {
    // aktiv: Online-Zahlung möglich · system: Tablet im Laden ist an (sonst Bar/Karte per WhatsApp)
    antwort(['aktiv' => $aktiv, 'system' => system_an()]);
}
if ($methode !== 'POST') {
    antwort(['fehler' => 'Nicht erlaubt.'], 405);
}
if (!$aktiv) {
    antwort(['fehler' => 'Online-Zahlung ist gerade nicht möglich. Bitte bar oder mit Karte bei Übergabe bezahlen.'], 503);
}
$origin = parse_url((string) ($_SERVER['HTTP_ORIGIN'] ?? ''), PHP_URL_HOST);
if ($origin !== null && $origin !== false && !in_array(strtolower($origin), ERLAUBTE_HOSTS, true)) {
    antwort(['fehler' => 'Nicht erlaubt.'], 403);
}

$roh = (string) file_get_contents('php://input', false, null, 0, 100000);
$d = json_decode($roh, true);
if (!is_array($d)) {
    antwort(['fehler' => 'Ungültige Anfrage.'], 400);
}

$n = jetzt();
try {
    $b = bestellung_pruefen($d, $n);
} catch (InvalidArgumentException $e) {
    antwort(['fehler' => $e->getMessage()], 422);
}
$b['nr'] = neue_nr($n);
$b['eingang'] = $n->format('c');

// Positionen für Stripe
$p = [
    'mode' => 'payment',
    'locale' => 'de',
    'client_reference_id' => $b['nr'],
    'success_url' => seite() . 'kasse.html?bezahlt={CHECKOUT_SESSION_ID}',
    'cancel_url' => seite() . 'kasse.html?abgebrochen=1',
    'expires_at' => time() + 31 * 60,
    'line_items' => [],
    'payment_intent_data' => ['description' => 'Bestellung ' . $b['nr'] . ' – Neusser Döner & Pizza', 'metadata' => ['nr' => $b['nr']]],
];
foreach ($b['positionen'] as $z) {
    $det = implode(', ', array_filter(array_merge($z['optionen'], [$z['notiz'] !== '' ? 'Wunsch: ' . $z['notiz'] : ''])));
    $produkt = ['name' => $z['name'] . ($z['groesse'] !== '' ? ' (' . $z['groesse'] . ')' : '')];
    if ($det !== '') {
        $produkt['description'] = mb_substr($det, 0, 300);
    }
    $p['line_items'][] = ['quantity' => $z['menge'],
        'price_data' => ['currency' => 'eur', 'unit_amount' => cent($z['stueck']), 'product_data' => $produkt]];
}
if ($b['liefergebuehr'] > 0) {
    $p['line_items'][] = ['quantity' => 1,
        'price_data' => ['currency' => 'eur', 'unit_amount' => cent($b['liefergebuehr']), 'product_data' => ['name' => 'Liefergebühr']]];
}
if ($b['email'] !== '') {
    $p['customer_email'] = $b['email'];
}

// Kurzfassung im Stripe-Dashboard (je Feld höchstens 500 Zeichen)
$positionen = implode('; ', array_map('zeile_text', $b['positionen']));
$p['metadata'] = array_map(fn ($v) => mb_substr((string) $v, 0, 500), [
    'nr' => $b['nr'],
    'art' => $b['art'],
    'zeit' => $b['zeit'],
    'name' => $b['name'],
    'telefon' => $b['telefon'],
    'adresse' => $b['art'] === 'lieferung'
        ? trim($b['strasse'] . ' ' . $b['hausnr'] . ', ' . $b['plz'] . ' ' . $b['ort'] . ($b['etage'] !== '' ? ', ' . $b['etage'] : ''))
        : 'Abholung',
    'bemerkung' => $b['bemerkung'],
    'positionen' => $positionen,
]);

try {
    if (!empty($b['rabatt'])) {
        $coupon = stripe('POST', 'coupons', ['amount_off' => cent($b['rabatt']['betrag']), 'currency' => 'eur',
            'duration' => 'once', 'max_redemptions' => 1, 'name' => mb_substr($b['rabatt']['titel'], 0, 40)]);
        $p['discounts'] = [['coupon' => $coupon['id']]];
    }
    $s = stripe('POST', 'checkout/sessions', $p);
} catch (RuntimeException $e) {
    error_log('Stripe-Checkout: ' . $e->getMessage());
    antwort(['fehler' => 'Die Bezahlseite konnte nicht geöffnet werden. Bitte noch einmal versuchen oder bar bezahlen.'], 502);
}

$b['stripe_session'] = $s['id'];
// abgebrochene Zahlungen nach zwei Tagen wegräumen
foreach (glob(ordner() . '/offen-*.json') ?: [] as $alt) {
    if (filemtime($alt) < time() - 2 * 86400) {
        unlink($alt);
    }
}
file_put_contents(ordner() . '/offen-' . $b['nr'] . '.json', json_encode($b, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
antwort(['url' => $s['url']]);
