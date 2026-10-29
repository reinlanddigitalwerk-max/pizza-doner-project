<?php
// Bestellung mit Bezahlung bei Übergabe (bar oder Karte): prüfen, nachrechnen, für das Tablet im Laden ablegen.
//   POST → {"nr": "W…", "gesamt": 23.5}  oder  {"fehler": "…"}
declare(strict_types=1);
require __DIR__ . '/lib.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    antwort(['fehler' => 'Nicht erlaubt.'], 405);
}
$origin = parse_url((string) ($_SERVER['HTTP_ORIGIN'] ?? ''), PHP_URL_HOST);
if ($origin !== null && $origin !== false && !in_array(strtolower($origin), ERLAUBTE_HOSTS, true)) {
    antwort(['fehler' => 'Nicht erlaubt.'], 403);
}
$d = json_decode((string) file_get_contents('php://input', false, null, 0, 100000), true);
if (!is_array($d)) {
    antwort(['fehler' => 'Ungültige Anfrage.'], 400);
}
$zahlung = $d['zahlung'] ?? '';
if (!in_array($zahlung, ['bar', 'karte'], true)) {
    antwort(['fehler' => 'Bitte bar oder Karte bei Übergabe wählen.'], 422);
}

$n = jetzt();
try {
    $b = bestellung_pruefen($d, $n);
} catch (InvalidArgumentException $e) {
    antwort(['fehler' => $e->getMessage()], 422);
}
$b['nr'] = neue_nr($n);
$b['eingang'] = $n->format('c');
$b['zahlung'] = $zahlung;
$b = speichern($b);
melden($b);
antwort(['nr' => $b['nr'], 'gesamt' => $b['gesamt']]);
