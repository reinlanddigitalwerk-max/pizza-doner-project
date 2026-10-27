<?php
// Stripe meldet hier bezahlte Bestellungen (Stripe-Dashboard → Entwickler → Webhooks):
//   URL:       https://neusser-doner-pizza.de/api/webhook.php
//   Ereignisse: checkout.session.completed, checkout.session.async_payment_succeeded
declare(strict_types=1);
require __DIR__ . '/lib.php';

$geheimnis = (string) (geheim()['webhook_secret'] ?? '');
$roh = (string) file_get_contents('php://input');
$kopf = (string) ($_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '');
if ($geheimnis === '' || $kopf === '') {
    antwort(['fehler' => 'nicht eingerichtet'], 400);
}

// Signatur prüfen: t=Zeit, v1=HMAC-SHA256("t.payload")
$t = 0;
$sig = [];
foreach (explode(',', $kopf) as $teil) {
    [$k, $v] = array_pad(explode('=', trim($teil), 2), 2, '');
    if ($k === 't') $t = (int) $v;
    if ($k === 'v1') $sig[] = $v;
}
$soll = hash_hmac('sha256', $t . '.' . $roh, $geheimnis);
$ok = false;
foreach ($sig as $v) {
    $ok = $ok || hash_equals($soll, $v);
}
if (!$ok || abs(time() - $t) > 300) {
    antwort(['fehler' => 'Signatur ungültig'], 400);
}

$e = json_decode($roh, true);
$typ = $e['type'] ?? '';
if (in_array($typ, ['checkout.session.completed', 'checkout.session.async_payment_succeeded'], true)) {
    verarbeiten($e['data']['object'] ?? []);
}
antwort(['ok' => true]);
