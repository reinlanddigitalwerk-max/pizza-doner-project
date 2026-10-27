<?php
// Danke-Seite: Ist die Zahlung durch? GET ?id=cs_…  → {"bezahlt": true, "nr": "…", …}
// Verbucht die Bestellung auch hier (falls der Webhook noch nicht da war) – aber nur einmal.
declare(strict_types=1);
require __DIR__ . '/lib.php';

$id = (string) ($_GET['id'] ?? '');
if (!preg_match('/^cs_(test|live)_[A-Za-z0-9]{10,200}$/', $id)) {
    antwort(['fehler' => 'Ungültige Zahlung.'], 400);
}
try {
    $s = stripe('GET', 'checkout/sessions/' . $id);
} catch (RuntimeException $e) {
    error_log('Stripe-Status: ' . $e->getMessage());
    antwort(['fehler' => 'Zahlung konnte nicht geprüft werden.'], 502);
}
$b = verarbeiten($s);
antwort([
    'bezahlt' => (bool) $b,
    'status' => $s['payment_status'] ?? '',
    'nr' => $s['metadata']['nr'] ?? '',
    'art' => $s['metadata']['art'] ?? '',
    'zeit' => $s['metadata']['zeit'] ?? '',
    'betrag' => ($s['amount_total'] ?? 0) / 100,
]);
